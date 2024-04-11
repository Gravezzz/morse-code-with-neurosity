const { Neurosity } = require("@neurosity/sdk");
require("dotenv").config();

const deviceId = process.env.DEVICE_ID || "";
const email = process.env.EMAIL || "";
const password = process.env.PASSWORD || "";

const verifyEnvs = (email, password, deviceId) => {
    const invalidEnv = (env) => {
      return env === "" || env === 0;
    };
    if (invalidEnv(email) || invalidEnv(password) || invalidEnv(deviceId)) {
      console.error(
        "Please verify deviceId, email and password are in .env file, quitting..."
      );
      process.exit(0);
    }
  };
  verifyEnvs(email, password, deviceId);
  
  console.log(`${email} attempting to authenticate to ${deviceId}`);

  const neurosity = new Neurosity({
    deviceId,
    timesync: true
  });


const bufferSize = 40;
let baseline = null;
let brainwaveBuffer = [];
let baselineHasBeenSet = false;
let consecutiveExceedances = 0;
let consecutiveNonExceedances = 0;
let morseCode = "";
let baselinSettingStarted = false;

// Function to calculate baseline from buffer
// function calculateBaselineFromBuffer() {
//   const bufferLength = brainwaveBuffer.length;
//   if (bufferLength === 0) return null;

//   let sum = 0;
//   let maxDividedByTenHerz = -100;
//   for (let i = 0; i < bufferLength; i++) {
//     const alphaWaves = brainwaveBuffer[i].alpha;
//     const averageAlpha = alphaWaves.reduce((acc, val) => acc + val, 0) / alphaWaves.length;
//     const powerOfTwo = Math.pow(averageAlpha, 2);
//     const dividedByTenHerz = powerOfTwo / 10;
//     sum += dividedByTenHerz;
//     // Update the maximum value
//     if (dividedByTenHerz > maxDividedByTenHerz) {
//         maxDividedByTenHerz = dividedByTenHerz;
//     }
//   }
//   return maxDividedByTenHerz;
// }

// Function to calculate baseline from buffer
function calculateBaselineFromBuffer() {
    const bufferLength = brainwaveBuffer.length;
    if (bufferLength === 0) return null;
  
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const alphaWaves = brainwaveBuffer[i].alpha;
      const averageAlpha = alphaWaves.reduce((acc, val) => acc + val, 0) / alphaWaves.length;
      const powerOfTwo = Math.pow(averageAlpha, 2);
      const dividedByTenHerz = powerOfTwo / 10;
      sum += dividedByTenHerz;
    }
    return sum / bufferLength;
  }

// Function to calculate baseline from single latest record
function calculateBaselineFromLatest(data) {
  const alphaWaves = data.alpha;
  const averageAlpha = alphaWaves.reduce((acc, val) => acc + val, 0) / alphaWaves.length;
  const powerOfTwo = Math.pow(averageAlpha, 2);
  return powerOfTwo / 10;
}

// Function to set baseline after 10 seconds
function setBaseline() {
  if (!baselinSettingStarted) {
    baselinSettingStarted = true;
    console.log("Sit back, relax, and keep your eyes open for the baseline setup for 10 seconds.");
    setTimeout(() => {
      baseline = calculateBaselineFromBuffer();
      console.log("Baseline set:", baseline);
      console.log("Prepare to start a morse code in 5 seconds.");
      setTimeout(() => {
      console.log("Blink!")
      baselineHasBeenSet = true;
      }, 5)
    }, 1); // 10 seconds
  }
}

const MorseCodeDecoder = {
    ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
    "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
    "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
    ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
    "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
    "--..": "Z", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
    ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9",
    "-----": "0", "": " ", "/": " " // Space for next word
  };
  
  function decodeMorseCode(morseCode) {
    const decoded = morseCode.split(" ").map(code => MorseCodeDecoder[code]);
    return decoded.join("");
  }

// const stopAfterOneSecond = () => {
//     setTimeout(() => {
//         console.log("Subscription stopped after 1 second.");
//         process.exit(0); // Exit the program
//     }, 1000); // 1 second
// };

  const main = async () => {
    await neurosity
      .login({
        email,
        password
      })
      .catch((error) => {
        console.log(error);
        throw new Error(error);
      });
    console.log("Logged in");

    // Subscribe to brainwaves
    neurosity.brainwaves("powerByBand").subscribe((brainwaves) => {
    // stopAfterOneSecond();
    // console.log(brainwaves);
    // process.exit(0);
    brainwaveBuffer.push(brainwaves.data);
    if (brainwaveBuffer.length > bufferSize) {
        brainwaveBuffer.shift(); // Remove the oldest record if buffer size exceeds 40
    }

    const dividedByTenHerzFromLatest = calculateBaselineFromLatest(brainwaves.data);
    console.log("Result from latest:", dividedByTenHerzFromLatest);

    if (!baselineHasBeenSet) {
        setBaseline(); // Call setBaseline only if baselineHasBeenSet is false
    } else {
        baseline = 2.23;
    // Check if dividedByTenHerzFromLatest exceeds the baseline
    if (dividedByTenHerzFromLatest > baseline) {
        consecutiveExceedances++;
        consecutiveNonExceedances = 0; // Reset consecutive non-exceedances
    } else {
        consecutiveExceedances = 0; // Reset consecutive exceedances
        consecutiveNonExceedances++;
    }

    // Morse code interpretation
    if (consecutiveExceedances === 3) {
        morseCode += ".";
        console.log(morseCode);
    } else if (consecutiveExceedances === 9) {
        morseCode = morseCode.slice(0, -1) + "-";
        console.log(morseCode);
    } else if (consecutiveNonExceedances === 9) {
        morseCode += " "; // Space in Morse code
        console.log(morseCode);
    } else if (consecutiveNonExceedances === 28) {
        morseCode = morseCode.slice(0, -1) + "/";
        console.log(morseCode);
    }
    if (consecutiveNonExceedances >= 33) {        
        morseCode = morseCode.slice(0, -1);
        console.log("The morse code is: " + morseCode);
        console.log("Decoded Morse Code:", decodeMorseCode(morseCode));
        process.exit(0); // Exit the program
      }
    }
  }
);
    };
  
  main();