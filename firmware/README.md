# RehabMotion nRF52832 firmware

The Feather nRF52832 is **BLE-only**. It will not show up in macOS
**System Settings → Bluetooth**. That list is for Classic Bluetooth pairing.
The Python bridge is what connects to this board.

## Flash

1. Arduino IDE: board **Adafruit Feather nRF52832** (Adafruit nRF52 BSP).
2. Open `firmware/RehabMotion/RehabMotion.ino`.
3. Upload over USB.

The board notifies a **52-byte** motion packet at about **52 Hz**. It waits
until the BLE MTU is large enough before sending; sending 52 bytes on the
default 23-byte MTU was dropping the connection.

Serial at `115200` should print:

```
RehabMotion advertising as BLE name RehabMotion, service 0xFFF0
```

The blue LED blinks while advertising.

## Wiring

| Sensor     | AD0     | I2C address |
|------------|---------|-------------|
| Upper arm  | GND     | `0x68`      |
| Forearm    | 3V      | `0x69`      |

SDA/SCL on the Feather I2C pins. Shared 3V and GND.

## Connect to the app

Keep the website running. Stop `--simulate`, then:

```bash
cd bridge
/tmp/motion-bridge-venv2/bin/python main.py --ble
```

You should see `Connected to RehabMotion`. Refresh http://127.0.0.1:5173/
and open **Settings → Device status**. Battery percent, charging, and
remaining level come from the Feather VBAT pin (A7).
