// =====================================================
// RoboMorph micro:bit (MakeCode) SINGLE CATEGORY VERSION
// ONE toolbox category: "RoboMorph" (ORANGE)
// NO Core group shown
// 3 groups inside: Robotic Arm / Robot Dog / Otto Robot
//
// Changes requested:
// - Orange category color
// - Remove Core blocks (no begin / range / offset shown)
// - "Set channel" uses dropdown S1..S8 (S1=ch0 ... S8=ch7)
// - Block order in each group:
//   1) set channel
//   2) set angle
//   3) pose
//   4) true/false block (boolean input)
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

    function setPWMFreq(freq: number) {
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
        write8(MODE1, oldmode | 0xA1)
    }

    export function init(addr: number = 0x40, freqHz: number = 50) {
        _addr = addr
        _freq = freqHz
        write8(MODE1, 0x00)
        setPWMFreq(freqHz)
        _inited = true
    }

    export function setPWM(channel: number, on: number, off: number) {
        if (!_inited) init(0x40, 50)
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
        if (!_inited) init(0x40, 50)
        let counts = Math.round(pulseUs * _freq * 4096 / 1000000)
        if (counts < 0) counts = 0
        if (counts > 4095) counts = 4095
        setPWM(channel, 0, counts)
    }
}

//% color=#FF6F00 icon="\uf0b1" block="RoboMorph"
//% groups=['Robotic Arm','Robot Dog','Otto Robot']
namespace RoboMorph {

    // -------------------------
    // Shared (hidden) servo helper
    // -------------------------
    const SERVO_MIN_US = 500
    const SERVO_MAX_US = 2500

    function clamp(v: number, lo: number, hi: number) {
        return Math.max(lo, Math.min(hi, v))
    }

    function writeServoAngle(ch: number, angle: number) {
        const a = clamp(angle, 0, 180)
        const pulse = SERVO_MIN_US + (a * (SERVO_MAX_US - SERVO_MIN_US)) / 180
        _PCA9685.setPulseUs(ch, pulse)
    }

    // =====================================================
    // Common dropdown for channels (S1..S8)
    // =====================================================
    export enum ServoPort {
        //% block="S1"
        S1 = 0,
        //% block="S2"
        S2 = 1,
        //% block="S3"
        S3 = 2,
        //% block="S4"
        S4 = 3,
        //% block="S5"
        S5 = 4,
        //% block="S6"
        S6 = 5,
        //% block="S7"
        S7 = 6,
        //% block="S8"
        S8 = 7
    }

    // =====================================================
    // ROBOTIC ARM
    // =====================================================
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

    // default mapping (joint 0..7 -> S1..S8)
    let _armCh: number[] = [0, 1, 2, 3, 4, 5, 6, 7]

    //% group="Robotic Arm"
    //% weight=100
    //% blockId="rm_arm_set_channel_s" block="Arm set channel of %joint to %port"
    export function armSetChannel(joint: ArmJoint, port: ServoPort) {
        _armCh[joint] = port as number
    }

    //% group="Robotic Arm"
    //% weight=90
    //% blockId="rm_arm_set_angle_s" block="Arm set %joint angle %angle °"
    //% angle.min=0 angle.max=180
    export function armSetAngle(joint: ArmJoint, angle: number) {
        writeServoAngle(_armCh[joint], angle)
    }

    //% group="Robotic Arm"
    //% weight=80
    //% blockId="rm_arm_pose_s" block="Arm pose %pose"
    export function armPose(pose: ArmPose) {
        if (pose == ArmPose.Home) {
            armSetAngle(ArmJoint.Base, 90)
            armSetAngle(ArmJoint.Shoulder, 90)
            armSetAngle(ArmJoint.Elbow, 90)
            armSetAngle(ArmJoint.Wrist, 90)
            armSetAngle(ArmJoint.Gripper, 60)
        } else if (pose == ArmPose.Pick) {
            armSetAngle(ArmJoint.Base, 90)
            armSetAngle(ArmJoint.Shoulder, 120)
            armSetAngle(ArmJoint.Elbow, 60)
            armSetAngle(ArmJoint.Wrist, 90)
            armSetAngle(ArmJoint.Gripper, 20)
        } else if (pose == ArmPose.Place) {
            armSetAngle(ArmJoint.Base, 120)
            armSetAngle(ArmJoint.Shoulder, 110)
            armSetAngle(ArmJoint.Elbow, 70)
            armSetAngle(ArmJoint.Wrist, 90)
            armSetAngle(ArmJoint.Gripper, 80)
        } else {
            armSetAngle(ArmJoint.Base, 90)
            armSetAngle(ArmJoint.Shoulder, 80)
            armSetAngle(ArmJoint.Elbow, 120)
            armSetAngle(ArmJoint.Wrist, 60)
            basic.pause(200)
            armSetAngle(ArmJoint.Wrist, 120)
            basic.pause(200)
            armSetAngle(ArmJoint.Wrist, 60)
        }
    }

    //% group="Robotic Arm"
    //% weight=70
    //% blockId="rm_arm_gripper_bool_s" block="Arm gripper open %open"
    export function armGripper(open: boolean) {
        // tune for your gripper if needed
        armSetAngle(ArmJoint.Gripper, open ? 80 : 20)
    }

    // =====================================================
    // ROBOT DOG (8 servos)
    // =====================================================
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

    export enum DogPose {
        //% block="Stand"
        Stand = 0,
        //% block="Sit"
        Sit = 1
    }

    let _dogCh: number[] = [0, 1, 2, 3, 4, 5, 6, 7]

    //% group="Robot Dog"
    //% weight=100
    //% blockId="rm_dog_set_channel_s" block="Dog set channel of %joint to %port"
    export function dogSetChannel(joint: DogJoint, port: ServoPort) {
        _dogCh[joint] = port as number
    }

    //% group="Robot Dog"
    //% weight=90
    //% blockId="rm_dog_set_angle_s" block="Dog set %joint angle %angle °"
    //% angle.min=0 angle.max=180
    export function dogSetAngle(joint: DogJoint, angle: number) {
        writeServoAngle(_dogCh[joint], angle)
    }

    //% group="Robot Dog"
    //% weight=80
    //% blockId="rm_dog_pose_s" block="Dog pose %pose"
    export function dogPose(pose: DogPose) {
        if (pose == DogPose.Stand) {
            dogSetAngle(DogJoint.FL_Hip, 90); dogSetAngle(DogJoint.FL_Knee, 90)
            dogSetAngle(DogJoint.FR_Hip, 90); dogSetAngle(DogJoint.FR_Knee, 90)
            dogSetAngle(DogJoint.BL_Hip, 90); dogSetAngle(DogJoint.BL_Knee, 90)
            dogSetAngle(DogJoint.BR_Hip, 90); dogSetAngle(DogJoint.BR_Knee, 90)
        } else {
            dogSetAngle(DogJoint.FL_Knee, 120)
            dogSetAngle(DogJoint.FR_Knee, 120)
            dogSetAngle(DogJoint.BL_Knee, 60)
            dogSetAngle(DogJoint.BR_Knee, 60)
        }
    }

    function dogFrame(a0: number, a1: number, a2: number, a3: number, a4: number, a5: number, a6: number, a7: number, holdMs: number) {
        dogSetAngle(DogJoint.FL_Hip, a0); dogSetAngle(DogJoint.FL_Knee, a1)
        dogSetAngle(DogJoint.FR_Hip, a2); dogSetAngle(DogJoint.FR_Knee, a3)
        dogSetAngle(DogJoint.BL_Hip, a4); dogSetAngle(DogJoint.BL_Knee, a5)
        dogSetAngle(DogJoint.BR_Hip, a6); dogSetAngle(DogJoint.BR_Knee, a7)
        basic.pause(holdMs)
    }

    //% group="Robot Dog"
    //% weight=70
    //% blockId="rm_dog_walk_bool_s" block="Dog walk forward %forward steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function dogWalk(forward: boolean, steps: number, speed: number) {
        const t = Math.idiv(220, speed) + 10

        // 4-frame simple gait (tune angles later)
        const f0 = [90, 90, 90, 90, 90, 90, 90, 90]
        const f1 = [80, 70, 100, 110, 100, 110, 80, 70]
        const f2 = [100, 110, 80, 70, 80, 70, 100, 110]

        for (let i = 0; i < steps; i++) {
            if (forward) {
                dogFrame(f0[0], f0[1], f0[2], f0[3], f0[4], f0[5], f0[6], f0[7], t)
                dogFrame(f1[0], f1[1], f1[2], f1[3], f1[4], f1[5], f1[6], f1[7], t)
                dogFrame(f0[0], f0[1], f0[2], f0[3], f0[4], f0[5], f0[6], f0[7], t)
                dogFrame(f2[0], f2[1], f2[2], f2[3], f2[4], f2[5], f2[6], f2[7], t)
            } else {
                // backward = reverse order
                dogFrame(f0[0], f0[1], f0[2], f0[3], f0[4], f0[5], f0[6], f0[7], t)
                dogFrame(f2[0], f2[1], f2[2], f2[3], f2[4], f2[5], f2[6], f2[7], t)
                dogFrame(f0[0], f0[1], f0[2], f0[3], f0[4], f0[5], f0[6], f0[7], t)
                dogFrame(f1[0], f1[1], f1[2], f1[3], f1[4], f1[5], f1[6], f1[7], t)
            }
        }
    }

    // =====================================================
    // OTTO ROBOT (4 servos)
    // =====================================================
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

    export enum OttoPose {
        //% block="Home"
        Home = 0
    }

    let _ottoCh: number[] = [0, 1, 2, 3]

    //% group="Otto Robot"
    //% weight=100
    //% blockId="rm_otto_set_channel_s" block="Otto set channel of %servo to %port"
    export function ottoSetChannel(servo: OttoServo, port: ServoPort) {
        _ottoCh[servo] = port as number
    }

    //% group="Otto Robot"
    //% weight=90
    //% blockId="rm_otto_set_angle_s" block="Otto set %servo angle %angle °"
    //% angle.min=0 angle.max=180
    export function ottoSetAngle(servo: OttoServo, angle: number) {
        writeServoAngle(_ottoCh[servo], angle)
    }

    //% group="Otto Robot"
    //% weight=80
    //% blockId="rm_otto_pose_s" block="Otto pose %pose"
    export function ottoPose(pose: OttoPose) {
        // only Home for now
        ottoSetAngle(OttoServo.LH, 90)
        ottoSetAngle(OttoServo.RH, 90)
        ottoSetAngle(OttoServo.LF, 90)
        ottoSetAngle(OttoServo.RF, 90)
    }

    //% group="Otto Robot"
    //% weight=70
    //% blockId="rm_otto_walk_bool_s" block="Otto walk forward %forward steps %steps speed %speed"
    //% steps.min=1 steps.max=30 speed.min=1 speed.max=10
    export function ottoWalk(forward: boolean, steps: number, speed: number) {
        const t = Math.idiv(200, speed) + 10

        for (let i = 0; i < steps; i++) {
            if (forward) {
                ottoSetAngle(OttoServo.LH, 80); ottoSetAngle(OttoServo.RH, 100)
                ottoSetAngle(OttoServo.LF, 70); ottoSetAngle(OttoServo.RF, 110)
                basic.pause(t)

                ottoSetAngle(OttoServo.LH, 100); ottoSetAngle(OttoServo.RH, 80)
                ottoSetAngle(OttoServo.LF, 110); ottoSetAngle(OttoServo.RF, 70)
                basic.pause(t)
            } else {
                // backward = swap foot extremes
                ottoSetAngle(OttoServo.LH, 80); ottoSetAngle(OttoServo.RH, 100)
                ottoSetAngle(OttoServo.LF, 110); ottoSetAngle(OttoServo.RF, 70)
                basic.pause(t)

                ottoSetAngle(OttoServo.LH, 100); ottoSetAngle(OttoServo.RH, 80)
                ottoSetAngle(OttoServo.LF, 70); ottoSetAngle(OttoServo.RF, 110)
                basic.pause(t)
            }
        }
        ottoPose(OttoPose.Home)
    }
}