import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const quat = await server.ssrLoadModule('/src/motion/quat.ts')
const sensors = await server.ssrLoadModule('/src/motion/sensors.ts')
const ik = await server.ssrLoadModule('/src/motion/ik.ts')
const exercises = await server.ssrLoadModule('/src/motion/exercises.ts')
const rig = await server.ssrLoadModule('/src/rig/HumanoidRig.ts')
const THREE = await server.ssrLoadModule('three')

const failures = []

function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`)
  else console.log(`ok  ${name}`)
}

const angles = {
  shoulderFlexion: 35,
  shoulderAbduction: 20,
  elbowFlexion: 80,
  wristFlexion: -15,
}
const pose = quat.poseFromAngles(angles, 'right')
const back = quat.anglesFromArm(pose, 'right')
for (const key of Object.keys(angles)) {
  check(`roundtrip ${key}`, Math.abs(back[key] - angles[key]) < 0.05, `${back[key]} vs ${angles[key]}`)
}

const elbow90 = quat.poseFromAngles({ ...angles, shoulderFlexion: 0, shoulderAbduction: 0, elbowFlexion: 90, wristFlexion: 0 }, 'right')
const elbowBack = quat.anglesFromArm(elbow90, 'right')
check('elbow 90 roundtrip', Math.abs(elbowBack.elbowFlexion - 90) < 0.05, String(elbowBack.elbowFlexion))

const body = quat.poseFromAngles({ shoulderFlexion: 25, shoulderAbduction: 12, elbowFlexion: 70, wristFlexion: 8 }, 'right')
const sensor = sensors.sensorFromBody(body, true)
const cal = sensors.captureCalibration(body, true)
const recovered = sensors.applyCalibration(sensor, cal)
check('calibration cancels mount', quat.quatAngleDeg(recovered.upper, body.upper) < 0.05, String(quat.quatAngleDeg(recovered.upper, body.upper)))
check('mount actually changes the pose', quat.quatAngleDeg(sensor.upper, body.upper) > 5)

const rawElbow = quat.quatMagnitudeDeg(quat.relativeQuat(sensor.upper, sensor.fore))
const trueElbow = quat.quatMagnitudeDeg(quat.relativeQuat(body.upper, body.fore))
check('different mounts break naive joint angle', Math.abs(rawElbow - trueElbow) > 2, `${rawElbow} vs ${trueElbow}`)
const fixedElbow = quat.quatMagnitudeDeg(quat.relativeQuat(recovered.upper, recovered.fore))
check('calibrated joint angle matches', Math.abs(fixedElbow - trueElbow) < 0.05, `${fixedElbow} vs ${trueElbow}`)

const shoulder = new THREE.Vector3(0.2, 1.41, 0)
const target = shoulder.clone().add(new THREE.Vector3(0.05, -0.15, 0.42))
const solved = ik.solveArmIk(target, 'right')
check('ik reach error under 1cm', solved.errorCm < 1, String(solved.errorCm))
check('ik elbow flexion is plausible', solved.elbowFlexion > 15 && solved.elbowFlexion < 160, String(solved.elbowFlexion))

const far = shoulder.clone().add(new THREE.Vector3(0, -2, 0.2))
const farSolve = ik.solveArmIk(far, 'right')
check('far target is clamped', farSolve.clamped)

const exercise = exercises.EXERCISES[0]
const start = exercises.sampleExercise(exercise, 0)
const mid = exercises.sampleExercise(exercise, 2)
check('exercise starts near straight', start.elbowFlexion < 12, String(start.elbowFlexion))
check('exercise peaks near 90', Math.abs(mid.elbowFlexion - 90) < 1, String(mid.elbowFlexion))

const gen = await server.ssrLoadModule('/src/ai/generateExercise.ts')
const fakeShoulderSquat = gen.normalizeGeneratedExercise({
  name: 'Arm raise',
  focus: 'shoulder',
  laterality: 'uni',
  keyframes: [
    { time: 0, angles: { shoulderFlexion: 10, shoulderAbduction: 12, elbowFlexion: 8, hipFlexion: 0, kneeFlexion: 5 } },
    { time: 2, angles: { shoulderFlexion: 110, shoulderAbduction: 20, elbowFlexion: 8, hipFlexion: 0, kneeFlexion: 5 } },
    { time: 4, angles: { shoulderFlexion: 10, shoulderAbduction: 12, elbowFlexion: 8, hipFlexion: 0, kneeFlexion: 5 } },
  ],
}, 'lower body squats, 8 reps')
check('prompt squat overrides shoulder JSON', fakeShoulderSquat.focus === 'knee', fakeShoulderSquat.focus)
check('prompt squat is bilateral', fakeShoulderSquat.laterality === 'bi')
const squatMidGen = fakeShoulderSquat.keyframes.reduce((best, frame) => Math.max(best, frame.angles.kneeFlexion), 0)
check('repaired squat actually bends the knee', squatMidGen > 50, String(squatMidGen))
check('repaired squat also bends the hip', fakeShoulderSquat.keyframes.some((frame) => frame.angles.hipFlexion > 40))
check('squat prompt inferred as knee', gen.inferFocusFromText('lower body squats') === 'knee')

const squat = exercises.EXERCISES.find((item) => item.id === 'mini-squat')
const squatStart = exercises.sampleExercise(squat, 0)
const squatMid = exercises.sampleExercise(squat, 2.4)
check('squat starts nearly straight', squatStart.kneeFlexion < 15, String(squatStart.kneeFlexion))
check('squat bends the knee', squatMid.kneeFlexion > 50, String(squatMid.kneeFlexion))
check('squat also flexes the hip', squatMid.hipFlexion > 40, String(squatMid.hipFlexion))

const legAngles = { ...angles, hipFlexion: 40, hipAbduction: 12, kneeFlexion: 70, ankleFlexion: 10 }
const legPose = quat.poseFromAngles(legAngles, 'right')
const legBack = quat.anglesFromArm(legPose, 'right')
check('knee roundtrip', Math.abs(legBack.kneeFlexion - 70) < 0.05, String(legBack.kneeFlexion))
check('hip roundtrip', Math.abs(legBack.hipFlexion - 40) < 0.05, String(legBack.hipFlexion))

const tests = rig.adapterSelfTest()
check('alias adapter', tests.every((item) => item.ok), tests.map((item) => item.label).join(', '))

await server.close()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('all motion checks passed')
