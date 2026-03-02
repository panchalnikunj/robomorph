// =====================================================
// RoboMorph micro:bit (MakeCode) single-file extension code
// PCA9685 + 8 servos + 3 sections: Arm / Dog / Otto
// Paste this entire code into main.ts (JavaScript view)
// =====================================================

//% blockHidden=true
namespace _PCA9685 {
    let _addr = 0x40
    let _freq = 50
    let _inited = false

    const MODE1 = 0x00
    const PRESCALE = 0xFE
    const LED0_ON_L = 0x06

    function write8(reg: number, val: number): void {
        const b = pins.createBuffer(2)
        b[0] = reg
        b[1] = val
        pins.i2cWriteBuffer(_addr, b)
    }

    function read8(reg: number): number {
        pins.i2cWriteNumber(_addr, reg, NumberFormat.UInt8BE, true)
        return pins.i2cReadNumber(_addr, NumberFormat.UInt8BE, false)
    }

    export function setAddress(addr: number) {
        _addr = addr
        _inited = false
    }

    export function init(freqHz: number = 50) {
        _freq = freqHz
        write8(MODE1, 0x00)
        setPWMFreq(freqHz)
        _inited = true
    }

    function setPWMFreq(freq: number) {
        // prescale = round(25MHz/(4096*freq)) - 1
        let prescaleval = 25000000
        prescaleval = prescaleval / 4096
        prescaleval = prescaleval / freq
        prescaleval = prescaleval - 1
        const prescale = Math.floor(prescaleval + 0.5)

        const oldmode = read8(MODE1)
        const sleep = (oldmode & 0x7F) | 0x10
        write8(MODE1, sleep)
        write8(PRESCALE, prescale)
        write8(MODE1, oldmode)
        basic.pause(5)
        write8(MODE1, oldmode | 0xA1) // restart + auto-increment
    }

    export function setPWM(channel: number, on: number, off: number) {
        if (!_inited) init(50)
        const reg = LED0_ON_L + 4 * channel
        const b = pins.createBuffer(5)
        b[0] = reg
        b[1] = on & 0xFF
        b[2] = (on >> 8) & 0xFF
        b[3] = off & 0xFF
        b[4] = (off >> 8) & 0xFF
        pins.i2cWriteBuffer(_addr, b)
    }

    export function setPulseUs(channel: number, pulseUs: number) {
        if (!_inited) init(50)
        // counts = pulseUs * freq * 4096 / 1e6
        let counts = Math.round(pulseUs * _freq * 4096 / 1000000)
        if (counts < 0) counts = 0
        if (counts > 4095) counts = 4095
        setPWM(channel, 0, counts)
    }
}

// =====================================================
// SECTION: ROBO MORPH CORE (PCA9685 + servo + calibration)
// =====================================================
//% color=#2D6CDF icon="\uf013" block="RoboMorph Core"
//% groups=['Setup','Servo','Calibration','Advanced']
namespace RoboMorph {
    let _minUs = 500
    let _maxUs = 2500

    const _offsetDeg: number[] = []
    const _invert: boolean[] = []

    function clamp(v: number, lo: number, hi: number) {
        return Math.max(lo, Math.min(hi, v))
    }

    function normAngle(ch: number, angle: number): number {
        let a = clamp(angle, 0, 180)
        if (_invert[ch]) a = 180 - a
        a = a + (_offsetDeg[ch] || 0)
        return clamp(a, 0, 180)
    }

    //% group="Setup"
    //% blockId="robomorph_begin_v1" block="RoboMorph begin PCA9685 address %addr freq %freqHz Hz"
    //% addr.min=0 addr.max=127 freqHz.min=40 freqHz.max=100
    export function begin(addr: number = 0x40, freqHz: number = 50) {
        _PCA9685.setAddress(addr)
        _PCA9685.init(freqHz)
        for (let i = 0; i < 16; i++) {
            _offsetDeg[i] = 0
            _invert[i] = false
        }
    }

    //% group="Setup"
    //% blockId="robomorph_servo_range_v1" block="Set servo pulse range min %minUs us max %maxUs us"
    //% minUs.min=400 minUs.max=1000 maxUs.min=2000 maxUs.max=3000
    export function setServoRange(minUs: number = 500, maxUs: number = 2500) {
        _minUs = minUs
        _maxUs = maxUs
    }

    //% group="Calibration"
    //% blockId="robomorph_set_offset_v1" block="Set servo ch %ch offset %deg °"
    //% ch.min=0 ch.max=15 deg.min=-45 deg.max=45
    export function setOffset(ch: number, deg: number) {
        _offsetDeg[ch] = deg
    }

    //% group="Calibration"
    //% blockId="robomorph_set_invert_v1" block="Invert servo ch %ch %inv"
    //% ch.min=0 ch.max=15
    export function setInvert(ch: number, inv: boolean) {
        _invert[ch] = inv
    }

    //% group="Servo"
    //% blockId="robomorph_servo_angle_v1" block="Servo ch %ch angle %angle °"
    //% ch.min=0 ch.max=15 angle.min=0 angle.max=180
    export function servoAngle(ch: number, angle: number) {
        const a = normAngle(ch, angle)
        const pulse = _minUs + (a * (_maxUs - _minUs)) / 180
        _PCA9685.setPulseUs(ch, pulse)
    }

    //% group="Servo"
    //% blockId="robomorph_stop_v1" block="Stop servo ch %ch"
    //% ch.min=0 ch.max=15
    export function stop(ch: number) {
        _PCA9685.setPWM(ch, 0, 0)
    }

    //% group="Advanced"
    //% blockId="robomorph_move_smooth_v1" block="Move servo ch %ch from %fromAngle ° to %toAngle ° in %ms ms"
    //% ch.min=0 ch.max=15 fromAngle.min=0 fromAngle.max=180 toAngle.min=0 toAngle.max=180 ms.min=50 ms.max=5000
    export function moveSmooth(ch: number, fromAngle: number, toAngle: number, ms: number) {
        const steps = 20
        for (let i = 0; i <= steps; i++) {
            const a = fromAngle + (toAngle - fromAngle) * (i / steps)
            servoAngle(ch, a)
            basic.pause(Math.max(1, Math.idiv(ms, steps)))
        }
    }
}

// =====================================================
// SECTION 1: ROBOTIC ARM
// =====================================================
//% color=#FF6F00 icon="\uf0b1" block="RoboMorph Arm"
//% groups=['Setup','Joints','Poses','Moves']
namespace RoboMorphArm {
    export enum ArmJoint {
        //% block="Base"
        Base = 0,
        //% block="Shoulder"
        Shoulder = 1,
        //% block="Elbow"
        Elbow = 2,
        //% block="Wrist"
        Wrist = 3,
        //% block="Gripper"
        Gripper = 4,
        //% block="Extra 1"
        Extra1 = 5,
        //% block="Extra 2"
        Extra2 = 6,
        //% block="Extra 3"
        Extra3 = 7
    }

    export enum ArmPose {
        //% block="Home"
        Home = 0,
        //% block="Pick"
        Pick = 1,
        //% block="Place"
        Place = 2,
        //% block="Wave"
        Wave = 3
    }

    // default channels for arm joints: 0..7
    let chMap: number[] = [0, 1, 2, 3, 4, 5, 6, 7]

    //% group="Setup"
    //% blockId="arm_set_channel_v1" block="Arm set %joint channel %ch"
    //% ch.min=0 ch.max=15
    export function setJointChannel(joint: ArmJoint, ch: number) {
        chMap[joint] = ch
    }

    //% group="Joints"
    //% blockId="arm_set_joint_v1" block="Arm set %joint angle %angle °"
    //% angle.min=0 angle.max=180
    export function setJoint(joint: ArmJoint, angle: number) {
        RoboMorph.servoAngle(chMap[joint], angle)
    }

    //% group="Moves"
    //% blockId="arm_gripper_v1" block="Arm gripper %open"
    export function gripper(open: boolean) {
        // tune these angles for your gripper
        setJoint(ArmJoint.Gripper, open ? 80 : 20)
    }

    //% group="Poses"
    //% blockId="arm_pose_v1" block="Arm pose %pose"
    export function pose(pose: ArmPose) {
        if (pose == ArmPose.Home) {
            setJoint(ArmJoint.Base, 90)
            setJoint(ArmJoint.Shoulder, 90)
            setJoint(ArmJoint.Elbow, 90)
            setJoint(ArmJoint.Wrist, 90)
            setJoint(ArmJoint.Gripper, 60)
        } else if (pose == ArmPose.Pick) {
            setJoint(ArmJoint.Base, 90)
            setJoint(ArmJoint.Shoulder, 120)
            setJoint(ArmJoint.Elbow, 60)
            setJoint(ArmJoint.Wrist, 90)
            setJoint(ArmJoint.Gripper, 20)
        } else if (pose == ArmPose.Place) {
            setJoint(ArmJoint.Base, 120)
            setJoint(ArmJoint.Shoulder, 110)
            setJoint(ArmJoint.Elbow, 70)
            setJoint(ArmJoint.Wrist, 90)
            setJoint(ArmJoint.Gripper, 80)
        } else {
            // Wave
            setJoint(ArmJoint.Base, 90)
            setJoint(ArmJoint.Shoulder, 80)
            setJoint(ArmJoint.Elbow, 120)
            setJoint(ArmJoint.Wrist, 60)
            basic.pause(200)
            setJoint(ArmJoint.Wrist, 120)
            basic.pause(200)
            setJoint(ArmJoint.Wrist, 60)
        }
    }
}

// =====================================================
// SECTION 2: ROBOT DOG (8 servos = 4 legs x 2 joints)
// =====================================================
//% color=#3F8E3F icon="\uf1b0" block="RoboMorph Dog"
//% groups=['Setup','Pose','Walk','Turn']
namespace RoboMorphDog {
    export enum DogJoint {
        //% block="Front Left Hip"
        FL_Hip = 0,
        //% block="Front Left Knee"
        FL_Knee = 1,
        //% block="Front Right Hip"
        FR_Hip = 2,
        //% block="Front Right Knee"
        FR_Knee = 3,
        //% block="Back Left Hip"
        BL_Hip = 4,
        //% block="Back Left Knee"
        BL_Knee = 5,
        //% block="Back Right Hip"
        BR_Hip = 6,
        //% block="Back Right Knee"
        BR_Knee = 7
    }

    // default channels for dog: 0..7
    let chMap: number[] = [0, 1, 2, 3, 4, 5, 6, 7]

    //% group="Setup"
    //% blockId="dog_set_channel_v1" block="Dog set %joint channel %ch"
    //% ch.min=0 ch.max=15
    export function setJointChannel(joint: DogJoint, ch: number) {
        chMap[joint] = ch
    }

    function setJ(j: DogJoint, a: number) {
        RoboMorph.servoAngle(chMap[j], a)
    }

    //% group="Pose"
    //% blockId="dog_stand_v1" block="Dog stand"
    export function stand() {
        // neutral pose (tune with RoboMorph offset/invert)
        setJ(DogJoint.FL_Hip, 90); setJ(DogJoint.FL_Knee, 90)
        setJ(DogJoint.FR_Hip, 90); setJ(DogJoint.FR_Knee, 90)
        setJ(DogJoint.BL_Hip, 90); setJ(DogJoint.BL_Knee, 90)
        setJ(DogJoint.BR_Hip, 90); setJ(DogJoint.BR_Knee, 90)
    }

    //% group="Pose"
    //% blockId="dog_sit_v1" block="Dog sit"
    export function sit() {
        setJ(DogJoint.FL_Knee, 120)
        setJ(DogJoint.FR_Knee, 120)
        setJ(DogJoint.BL_Knee, 60)
        setJ(DogJoint.BR_Knee, 60)
    }

    function frame(a0: number, a1: number, a2: number, a3: number, a4: number, a5: number, a6: number, a7: number, holdMs: number) {
        setJ(DogJoint.FL_Hip, a0); setJ(DogJoint.FL_Knee, a1)
        setJ(DogJoint.FR_Hip, a2); setJ(DogJoint.FR_Knee, a3)
        setJ(DogJoint.BL_Hip, a4); setJ(DogJoint.BL_Knee, a5)
        setJ(DogJoint.BR_Hip, a6); setJ(DogJoint.BR_Knee, a7)
        basic.pause(holdMs)
    }

    //% group="Walk"
    //% blockId="dog_walk_forward_v1" block="Dog walk forward steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function walkForward(steps: number, speed: number) {
        const t = Math.idiv(220, speed) + 10

        for (let i = 0; i < steps; i++) {
            // simple diagonal gait (tune with offsets/invert)
            frame(90, 90, 90, 90, 90, 90, 90, 90, t)
            frame(80, 70, 100, 110, 100, 110, 80, 70, t)
            frame(90, 90, 90, 90, 90, 90, 90, 90, t)
            frame(100, 110, 80, 70, 80, 70, 100, 110, t)
        }
    }

    //% group="Turn"
    //% blockId="dog_turn_left_v1" block="Dog turn left steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function turnLeft(steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            frame(85, 80, 95, 100, 85, 80, 95, 100, t)
            frame(95, 100, 85, 80, 95, 100, 85, 80, t)
        }
    }

    //% group="Turn"
    //% blockId="dog_turn_right_v1" block="Dog turn right steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function turnRight(steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            frame(95, 100, 85, 80, 95, 100, 85, 80, t)
            frame(85, 80, 95, 100, 85, 80, 95, 100, t)
        }
    }
}

// =====================================================
// SECTION 3: OTTO (4 servos default)
// =====================================================
//% color=#8A2BE2 icon="\uf11b" block="RoboMorph Otto"
//% groups=['Setup','Pose','Moves']
namespace RoboMorphOtto {
    export enum OttoServo {
        //% block="Left Hip"
        LH = 0,
        //% block="Right Hip"
        RH = 1,
        //% block="Left Foot"
        LF = 2,
        //% block="Right Foot"
        RF = 3
    }

    // default channels for otto: 0..3
    let chMap: number[] = [0, 1, 2, 3]

    //% group="Setup"
    //% blockId="otto_set_channel_v1" block="Otto set %s channel %ch"
    //% ch.min=0 ch.max=15
    export function setServoChannel(s: OttoServo, ch: number) {
        chMap[s] = ch
    }

    function setS(s: OttoServo, a: number) {
        RoboMorph.servoAngle(chMap[s], a)
    }

    //% group="Pose"
    //% blockId="otto_home_v1" block="Otto home"
    export function home() {
        setS(OttoServo.LH, 90)
        setS(OttoServo.RH, 90)
        setS(OttoServo.LF, 90)
        setS(OttoServo.RF, 90)
    }

    //% group="Moves"
    //% blockId="otto_walk_v1" block="Otto walk steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function walk(steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            setS(OttoServo.LH, 80); setS(OttoServo.RH, 100)
            setS(OttoServo.LF, 70); setS(OttoServo.RF, 110)
            basic.pause(t)

            setS(OttoServo.LH, 100); setS(OttoServo.RH, 80)
            setS(OttoServo.LF, 110); setS(OttoServo.RF, 70)
            basic.pause(t)
        }
        home()
    }

    //% group="Moves"
    //% blockId="otto_turn_v1" block="Otto turn %left steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function turn(left: boolean, steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            if (left) { setS(OttoServo.LH, 75); setS(OttoServo.RH, 95) }
            else { setS(OttoServo.LH, 95); setS(OttoServo.RH, 75) }
            setS(OttoServo.LF, 90); setS(OttoServo.RF, 90)
            basic.pause(t)
        }
        home()
    }
}