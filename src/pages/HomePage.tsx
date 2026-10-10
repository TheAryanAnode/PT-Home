import { Link } from 'react-router-dom'
import { NAV } from '../nav.ts'
import { useRehab } from '../store/rehabStore.ts'

export function HomePage() {
  const lastScore = useRehab((state) => state.lastScore)
  return (
    <div className="home">
      <p className="kicker">Physical therapy test bench</p>
      <h1>Same skeleton, several ways to move it.</h1>
      <p className="lede">
        Each page is a separate test of the digital twin: a rigged mannequin, cursor posing, a fake
        three-sensor stream, exercise playback, and scoring. Motion is generated in the browser.
      </p>
      {lastScore !== null ? <p className="score-pill">Last form score {lastScore}/100</p> : null}
      {NAV.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <div className="cards">
            {group.items.map((item) => (
              <Link key={item.to} to={item.to} className="card">
                <span className="kicker">{item.kicker}</span>
                <strong>{item.label}</strong>
                <p>{item.blurb}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
