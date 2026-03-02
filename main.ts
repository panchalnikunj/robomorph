// =====================================================
// RoboMorph micro:bit (MakeCode) SINGLE SECTION version
// ONE toolbox category: "RoboMorph"
// Inside it, 4 sub-sections (groups): Core / Robotic Arm / Robot Dog / Otto Robot
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
// ONE CATEGORY: RoboMorph
// 4 GROUPS inside: Core / Robotic Arm / Robot Dog / Otto Robot
// =====================================================

//% color=#2D6CDF icon="\uf013" block="RoboMorph"
//% groups=['Core','Robotic Arm','Robot Dog','Otto Robot']
namespace RoboMorph {

    // -------------------------
    // CORE (Shared)
    // -------------------------
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

    //% group="Core"
    //% blockId="rm_begin" block="begin PCA9685 address %addr freq %freqHz Hz"
    //% addr.min=0 addr.max=127 freqHz.min=40 freqHz.max=100
    export function begin(addr: number = 0x40, freqHz: number = 50) {
        _PCA9685.setAddress(addr)
        _PCA9685.init(freqHz)
        for (let i = 0; i < 16; i++) {
            _offsetDeg[i] = 0
            _invert[i] = false
        }
    }

    //% group="Core"
    //% blockId="rm_servo_range" block="set servo pulse range min %minUs us max %maxUs us"
    //% minUs.min=400 minUs.max=1000 maxUs.min=2000 maxUs.max=3000
    export function setServoRange(minUs: number = 500, maxUs: number = 2500) {
        _minUs = minUs
        _maxUs = maxUs
    }

    //% group="Core"
    //% blockId="rm_set_offset" block="set servo ch %ch offset %deg °"
    //% ch.min=0 ch.max=15 deg.min=-45 deg.max=45
    export function setOffset(ch: number, deg: number) {
        _offsetDeg[ch] = deg
    }

    //% group="Core"
    //% blockId="rm_set_invert" block="invert servo ch %ch %inv"
    //% ch.min=0 ch.max=15
    export function setInvert(ch: number, inv: boolean) {
        _invert[ch] = inv
    }

    //% group="Core"
    //% blockId="rm_servo_angle" block="servo ch %ch angle %angle °"
    //% ch.min=0 ch.max=15 angle.min=0 angle.max=180
    export function servoAngle(ch: number, angle: number) {
        const a = normAngle(ch, angle)
        const pulse = _minUs + (a * (_maxUs - _minUs)) / 180
        _PCA9685.setPulseUs(ch, pulse)
    }

    //% group="Core"
    //% blockId="rm_stop" block="stop servo ch %ch"
    //% ch.min=0 ch.max=15
    export function stop(ch: number) {
        _PCA9685.setPWM(ch, 0, 0)
    }

    //% group="Core"
    //% blockId="rm_move_smooth" block="move servo ch %ch from %fromAngle ° to %toAngle ° in %ms ms"
    //% ch.min=0 ch.max=15 fromAngle.min=0 fromAngle.max=180 toAngle.min=0 toAngle.max=180 ms.min=50 ms.max=5000
    export function moveSmooth(ch: number, fromAngle: number, toAngle: number, ms: number) {
        const steps = 20
        for (let i = 0; i <= steps; i++) {
            const a = fromAngle + (toAngle - fromAngle) * (i / steps)
            servoAngle(ch, a)
            basic.pause(Math.max(1, Math.idiv(ms, steps)))
        }
    }

    // -------------------------
    // ROBOTIC ARM (8 servos max)
    // -------------------------
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
    let _armCh: number[] = [0, 1, 2, 3, 4, 5, 6, 7]

    //% group="Robotic Arm"
    //% blockId="rm_arm_set_channel" block="Arm set %joint channel %ch"
    //% ch.min=0 ch.max=15
    export function armSetJointChannel(joint: ArmJoint, ch: number) {
        _armCh[joint] = ch
    }

    //% group="Robotic Arm"
    //% blockId="rm_arm_set_joint" block="Arm set %joint angle %angle °"
    //% angle.min=0 angle.max=180
    export function armSetJoint(joint: ArmJoint, angle: number) {
        servoAngle(_armCh[joint], angle)
    }

    //% group="Robotic Arm"
    //% blockId="rm_arm_gripper" block="Arm gripper %open"
    export function armGripper(open: boolean) {
        // tune these for your gripper
        armSetJoint(ArmJoint.Gripper, open ? 80 : 20)
    }

    //% group="Robotic Arm"
    //% blockId="rm_arm_pose" block="Arm pose %pose"
    export function armPose(pose: ArmPose) {
        if (pose == ArmPose.Home) {
            armSetJoint(ArmJoint.Base, 90)
            armSetJoint(ArmJoint.Shoulder, 90)
            armSetJoint(ArmJoint.Elbow, 90)
            armSetJoint(ArmJoint.Wrist, 90)
            armSetJoint(ArmJoint.Gripper, 60)
        } else if (pose == ArmPose.Pick) {
            armSetJoint(ArmJoint.Base, 90)
            armSetJoint(ArmJoint.Shoulder, 120)
            armSetJoint(ArmJoint.Elbow, 60)
            armSetJoint(ArmJoint.Wrist, 90)
            armSetJoint(ArmJoint.Gripper, 20)
        } else if (pose == ArmPose.Place) {
            armSetJoint(ArmJoint.Base, 120)
            armSetJoint(ArmJoint.Shoulder, 110)
            armSetJoint(ArmJoint.Elbow, 70)
            armSetJoint(ArmJoint.Wrist, 90)
            armSetJoint(ArmJoint.Gripper, 80)
        } else {
            // Wave
            armSetJoint(ArmJoint.Base, 90)
            armSetJoint(ArmJoint.Shoulder, 80)
            armSetJoint(ArmJoint.Elbow, 120)
            armSetJoint(ArmJoint.Wrist, 60)
            basic.pause(200)
            armSetJoint(ArmJoint.Wrist, 120)
            basic.pause(200)
            armSetJoint(ArmJoint.Wrist, 60)
        }
    }

    // -------------------------
    // ROBOT DOG (8 servos = 4 legs x 2 joints)
    // -------------------------
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
    let _dogCh: number[] = [0, 1, 2, 3, 4, 5, 6, 7]

    //% group="Robot Dog"
    //% blockId="rm_dog_set_channel" block="Dog set %joint channel %ch"
    //% ch.min=0 ch.max=15
    export function dogSetJointChannel(joint: DogJoint, ch: number) {
        _dogCh[joint] = ch
    }

    function dogSet(j: DogJoint, a: number) {
        servoAngle(_dogCh[j], a)
    }

    //% group="Robot Dog"
    //% blockId="rm_dog_stand" block="Dog stand"
    export function dogStand() {
        dogSet(DogJoint.FL_Hip, 90); dogSet(DogJoint.FL_Knee, 90)
        dogSet(DogJoint.FR_Hip, 90); dogSet(DogJoint.FR_Knee, 90)
        dogSet(DogJoint.BL_Hip, 90); dogSet(DogJoint.BL_Knee, 90)
        dogSet(DogJoint.BR_Hip, 90); dogSet(DogJoint.BR_Knee, 90)
    }

    //% group="Robot Dog"
    //% blockId="rm_dog_sit" block="Dog sit"
    export function dogSit() {
        dogSet(DogJoint.FL_Knee, 120)
        dogSet(DogJoint.FR_Knee, 120)
        dogSet(DogJoint.BL_Knee, 60)
        dogSet(DogJoint.BR_Knee, 60)
    }

    function dogFrame(a0: number, a1: number, a2: number, a3: number, a4: number, a5: number, a6: number, a7: number, holdMs: number) {
        dogSet(DogJoint.FL_Hip, a0); dogSet(DogJoint.FL_Knee, a1)
        dogSet(DogJoint.FR_Hip, a2); dogSet(DogJoint.FR_Knee, a3)
        dogSet(DogJoint.BL_Hip, a4); dogSet(DogJoint.BL_Knee, a5)
        dogSet(DogJoint.BR_Hip, a6); dogSet(DogJoint.BR_Knee, a7)
        basic.pause(holdMs)
    }

    //% group="Robot Dog"
    //% blockId="rm_dog_walk_forward" block="Dog walk forward steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function dogWalkForward(steps: number, speed: number) {
        const t = Math.idiv(220, speed) + 10
        for (let i = 0; i < steps; i++) {
            dogFrame(90, 90, 90, 90, 90, 90, 90, 90, t)
            dogFrame(80, 70, 100, 110, 100, 110, 80, 70, t)
            dogFrame(90, 90, 90, 90, 90, 90, 90, 90, t)
            dogFrame(100, 110, 80, 70, 80, 70, 100, 110, t)
        }
    }

    //% group="Robot Dog"
    //% blockId="rm_dog_turn_left" block="Dog turn left steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function dogTurnLeft(steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            dogFrame(85, 80, 95, 100, 85, 80, 95, 100, t)
            dogFrame(95, 100, 85, 80, 95, 100, 85, 80, t)
        }
    }

    //% group="Robot Dog"
    //% blockId="rm_dog_turn_right" block="Dog turn right steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function dogTurnRight(steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            dogFrame(95, 100, 85, 80, 95, 100, 85, 80, t)
            dogFrame(85, 80, 95, 100, 85, 80, 95, 100, t)
        }
    }

    // -------------------------
    // OTTO ROBOT (4 servos default)
    // -------------------------
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
    let _ottoCh: number[] = [0, 1, 2, 3]

    //% group="Otto Robot"
    //% blockId="rm_otto_set_channel" block="Otto set %s channel %ch"
    //% ch.min=0 ch.max=15
    export function ottoSetServoChannel(s: OttoServo, ch: number) {
        _ottoCh[s] = ch
    }

    function ottoSet(s: OttoServo, a: number) {
        servoAngle(_ottoCh[s], a)
    }

    //% group="Otto Robot"
    //% blockId="rm_otto_home" block="Otto home"
    export function ottoHome() {
        ottoSet(OttoServo.LH, 90)
        ottoSet(OttoServo.RH, 90)
        ottoSet(OttoServo.LF, 90)
        ottoSet(OttoServo.RF, 90)
    }

    //% group="Otto Robot"
    //% blockId="rm_otto_walk" block="Otto walk steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function ottoWalk(steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            ottoSet(OttoServo.LH, 80); ottoSet(OttoServo.RH, 100)
            ottoSet(OttoServo.LF, 70); ottoSet(OttoServo.RF, 110)
            basic.pause(t)

            ottoSet(OttoServo.LH, 100); ottoSet(OttoServo.RH, 80)
            ottoSet(OttoServo.LF, 110); ottoSet(OttoServo.RF, 70)
            basic.pause(t)
        }
        ottoHome()
    }

    //% group="Otto Robot"
    //% blockId="rm_otto_turn" block="Otto turn %left steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function ottoTurn(left: boolean, steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10
        for (let i = 0; i < steps; i++) {
            if (left) { ottoSet(OttoServo.LH, 75); ottoSet(OttoServo.RH, 95) }
            else { ottoSet(OttoServo.LH, 95); ottoSet(OttoServo.RH, 75) }
            ottoSet(OttoServo.LF, 90); ottoSet(OttoServo.RF, 90)
            basic.pause(t)
        }
        ottoHome()
    }
}