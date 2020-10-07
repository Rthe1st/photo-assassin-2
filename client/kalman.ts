import * as mathjs from 'mathjs'

//todo: how do we translate the API accuracy into uncertainty estimate /covariance
//can we assume 0 process noise at first to make it more simple?
// this would accuratly model static positions

// if we ever want to improve - consider using sensor data
// to compute position independtly of gps
// https://github.com/psiphi75/ahrs
// (I think this still wouldn't give us speed? but that can be derived from accerleration?)

//todo: discrate or continious noise?
// probably continous because we have a lot of time between measurements
// https://www.kalmanfilter.net/covextrap.html

// our state variables should be:
// - position (x, y, z)
// - speed
// - maybe acceleration?
// should speed be an input instead? I think so, maing our state ONLY position

// because we recieve speed as a measurement (from GPS)
// can we use it as an input? or do we have to us it as a measurement?
// if we have to use it as a measurement, then accerlation will be our input

// we can get accerlation if we want

// modeled on https://www.kalmanfilter.net/stateextrap.html

// control inputs are optional
// we can use a model that assumes static velocity
// and then account for changes in velocity using process noise
// as mentioned here (though recommended against)
// is we ever want to improve, need to incorporate an accerlation input
// into the model
// https://www.kalmanfilter.net/alphabeta.html

// our model has no inputs
// let u = mathjs.matrix([
//     [0], // x acc
//     [0], // y acc
//     [0], // z acc
// ])

// x = tDelta * x velocity

// calculates the change to state variables based on
// current state variables
//what unit is time?
function F(_: number): mathjs.Matrix{
    return mathjs.matrix([
        [ 1, 0],
        [ 0, 1],
    ])
}

// function acceleration(tDelta: number): number{
//     return 0.5 * mathjs.square(tDelta)
// }


// this is based on the equation 2 here
// https://en.wikipedia.org/wiki/Equations_of_motion#Uniform_acceleration
// which gives change in position based on velocity and accerlation
// accerlatation is assumed constant - which makes sense because we have only
// one instanaious value for it (as input) and assume it applies to the whole time period


// inputTransistionMatrix calcuates the change to any state variables
// caused by external input
// let G = mathjs.matrix([
//     [acceleration(tDelta), 0, 0],
//     [0, acceleration(tDelta), 0],
//     [0, 0, acceleration(tDelta)],
//     [tDelta, 0, 0],
//     [0, tDelta, 0],
//     [0, 0, tDelta],
// ])

function stateExtrapolation(
    F: mathjs.Matrix, // stateTransistionMatrix,
    x: mathjs.Matrix, //estimatedSystemState,
    // G, // inputTransistionMatrix,
    // u, // inputVariable,
    // w wouldn't actualy be supplied because it's unknown
    // instead it's modeled as part of Q (prcess noise uncertainty / covariance)
    // w, // processNoise
): mathjs.Matrix{
    // predictedSystemState
    let nextX = mathjs.multiply(F, x)
    // our model assumes constant velocity, so no accerlation input
    // actual accerleration is accoamdted in process noise
    // + mathjs.multiply(G, u)
    // + w
    return nextX
}

function covarianceExtrapolation(
    F: mathjs.Matrix, //state transition matrix
    P: mathjs.Matrix, // estimate uncertainty (covariance) of current state
    // assume no process error for now
    // (this is ok for modeling static positions)
    // Q: mathjs.Matrix, // process noise matrix
): mathjs.Matrix{
    let nextP = mathjs.multiply(
            mathjs.multiply(F, P),
            mathjs.transpose(F)
    )
    // + Q
    return nextP
}

let H = mathjs.matrix([
    [1, 0],
    [0, 1],
    // [0, 0, 1],
])

function stateUpdateEquation(
    oldX: mathjs.Matrix, // previous estimated system state
    K: mathjs.Matrix, // kalman gain
    z: mathjs.Matrix, // measurement (position in our case?)
    // H: mathjs.Matrix, //obervation matrix - I think identity matrix for us
): mathjs.Matrix{
    return <mathjs.Matrix>mathjs.add(
        oldX,mathjs.multiply(
            K,
            mathjs.subtract(
                z,
                mathjs.multiply(H, oldX)
            )
        )
    )
}

function covarianceUpdateEquation(
    p: mathjs.Matrix, // prior estimate uncertainty (covariance)
    k: mathjs.Matrix, // kalman gain
    // H: mathjs.Matrix, // observation matrix
    R: mathjs.Matrix, // measurement of uncertainty (measurement noise covariance matrix)
): mathjs.Matrix{
    //todo: 2 is not the right size
    let I = mathjs.identity(2)
    let thing = <mathjs.Matrix>mathjs.subtract(I, mathjs.multiply(k, H))
    let nextP = mathjs.add(
        mathjs.multiply(
            mathjs.multiply(thing, p),
            mathjs.transpose(thing)
        ),
        mathjs.multiply(
            mathjs.multiply(k, R),
            k
        )
    )
    return <mathjs.Matrix> nextP
}

function kalmanGain(
    p: mathjs.Matrix,// is a prior estimate uncertainty (covariance) matrix of the current sate (predicted at the previous state)
    H: mathjs.Matrix, // observation matrix
    R: mathjs.Matrix, // is a Measurement Uncertainty (measurement noise covariance matrix)
){

    let hTranspose = mathjs.transpose(H)

    let toInverse: mathjs.Matrix = <mathjs.Matrix>mathjs.add(
        mathjs.multiply(
            mathjs.multiply(H, p),
            hTranspose
        ),
        R
    )

    return mathjs.multiply(
        mathjs.multiply(
            p,
            hTranspose,
        ),
        mathjs.inv(toInverse)
    )
}


// export function init(xLocal: mathjs.Matrix, pLocal: mathjs.Matrix){
//     // todo: we should probably accept a P as well
//     // or at least axs much of a P as we accept in the update stage
//     x = xLocalx
//     p = pLocalx
// }x

// export function update(z: mathjs.Matrix, R: mathjs.Matrix, timeDelta: number){

//     let extrapolatedState = stateExtrapolation(x, F(timeDelta))
//     let extrapolatedCovariance = covarianceExtrapolation(F(timeDelta), p)

//     let K = kalmanGain(extrapolatedCovariance, H, R)
//     let estimatedState = stateUpdateEquation(extrapolatedState, K, z)
//     let estimatedCovariance = covarianceUpdateEquation(extrapolatedCovariance, K, R)

//     p = estimatedCovariance
//     x = estimatedState
//     return estimatedState

// }

let state: mathjs.Matrix = mathjs.matrix([
    [0],//x
    [0],//y
    // [0],//z
    // [0], // x velocity
    // [0], // y velocity
    // [0], // z velocity    
])

// initial covariance (estimates of uncertainty)
// vector of variance values for each dimension
// for x, y, z we should compute this from the accuracy number
// for velocity - not sure
// but we know velcotiy must be between 0 and 10 m/s
// so standard deviation is limited by that
let p: mathjs.Matrix = mathjs.matrix([
    [100, 0],//x, m^2
    [0, 100],//y, m^2
    // [100],//z, m^2
    // [100], // x velocity, (m/s)^2
    // [100], // y velocity, (m/s)^2
    // [100], // z velocity, (m/s)^2
])

export function init(
    x: number,
    y: number,
    accuracy: number, // x and y's accuray with 95% confidence
    // not needed till our state is dynamic
    // time: number
){
    // todo: we should probably accept a P as well
    // or at least as much of a P as we accept in the update stage
    state = mathjs.matrix([
        [x],
        [y]
    ])

    // accuracy is a 95% confidence interval in meters
    // https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy
    // 95% is approximately 4 standard deviations (95.45%)
    // https://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule
    // do divide by 4 and square to get the variances we want
    p = mathjs.matrix([
        [mathjs.square(accuracy/4), 0],
        [0, mathjs.square(accuracy/4)],
    ])
}

export function update(
    x: number,
    y: number,
    accuracy: number, // x and y's accuray with 95% confidence
    // not needed till our state is dynamic
    // time: number
    // z: mathjs.Matrix, R: mathjs.Matrix, timeDelta: number
){

    let z = mathjs.matrix([
        [x],
        [y]
    ])

    let timeDelta = 0;

    let extrapolatedState = stateExtrapolation(F(timeDelta), state)
    let extrapolatedCovariance = covarianceExtrapolation(F(timeDelta), p)

    let R = mathjs.matrix([
        [mathjs.square(accuracy/4), 0],
        [0, mathjs.square(accuracy/4)],
    ])

    let K = kalmanGain(extrapolatedCovariance, H, R)
    let estimatedState = stateUpdateEquation(extrapolatedState, K, z)
    let estimatedCovariance = covarianceUpdateEquation(extrapolatedCovariance, K, R)

    p = estimatedCovariance
    state = estimatedState
    return {
        x: estimatedState.get([0,0]),
        y: estimatedState.get([1,0])
    }
}
