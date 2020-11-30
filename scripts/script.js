
const Time = require('Time'); // To keep track of Time and trigger animations accordingly
const Audio = require('Audio'); // To play Level Unlock Audio
const Scene = require('Scene'); // To import Scene Elements 
const Blocks = require('Blocks'); // To instantiate blocks
const Patches = require('Patches'); // To exchange data between to Patch Editor and Script
const NativeUI = require('NativeUI'); // To create Native UI Picker
const Textures = require('Textures'); //  To import textures required by Native UI Picker 
const Animation = require('Animation'); // To Animate cubes, cylinders & tetrahedrons
const Materials = require('Materials'); // To import Materials 
const Persistence = require('Persistence'); // To store max level unlocked by the user
const Diagnostics = require('Diagnostics'); // To debug code
const CameraInfo = require('CameraInfo'); // To determine whether the user is using front/back camera


(async function () {
 
    //=========================================================================================
    // Dynamically Instantiating Objects + Importing corresponding Materials & Scene objects.
    //=========================================================================================

    const [gridPlane, kickDrumHitCircle, hiHatHitCircle, snareHitCircle, kickDrumHitCircleGlow, hiHatHitCircleGlow, snareHitCircleGlow, cameraPlatformItems, gridMaterial, circleMaterial, hiHatHitCircleGlowMaterial, snareHitCircleGlowMaterial, kickDrumCircleGlowMaterial, frontCameraPlatform, backCameraPlatform, frontCameraScoreText, backCameraScoreText ] = await Promise.all([
        
        Scene.create("Plane", {
            "name": "gridPlane",
        }),
 
        Scene.create("Plane", {
            "name": "kickDrumHitCircle",
        }),

        Scene.create("Plane", {
            "name": "hiHatHitCircle",
        }),

        Scene.create("Plane", {
            "name": "snareHitCircle",
        }),

        Scene.create("Plane", {
            "name": "kickDrumHitCircleGlow",
        }),

        Scene.create("Plane", {
            "name": "hiHatHitCircleGlow",
        }),

        Scene.create("Plane", {
            "name": "snareHitCircleGlow",

        }),

        //cameraPlatformItems will be used to group all the dynamically instantiated object.
        Scene.create("SceneObject", {
            "name": "cameraPlatformItems",
        }),

        Materials.findFirst("gridMaterial"),
        Materials.findFirst("circleMaterial"),
        Materials.findFirst("hiHatHitCircleGlowMaterial"),
        Materials.findFirst("snareHitCircleGlowMaterial"),
        Materials.findFirst("kickDrumCircleGlowMaterial"),

        Scene.root.findFirst('frontCameraPlatform'),
        Scene.root.findFirst('backCameraPlatform'),

        Scene.root.findFirst('frontCameraScoreText'),
        Scene.root.findFirst('backCameraScoreText'),

    ]);
    
    //To determine whether the user is using front/back camera at any given point.
    var frontCamera = false;

    //Stores the status of Dynamic Instantiation of objects.
    var instantiated = false;

    //scoreText will hold reference to frontCameraScoreText/backCameraScoreText
    var scoreText = frontCameraScoreText;
    
    //===============================================================================================================================
    // Import all the required Scene objects, Textures, AudioPlaybackController, Materials and Variables passed from Patch Editor
    //===============================================================================================================================
   
    const [band1, band2, band4, band7, frontCameraModelContainer, backCameraModelContainer, l1, l2, l3, l4, l5, l6, l7, lockTexture, recording, progressBarRectangle, confettiYellow, confettiGreen, unlockAudioPlaybackController] = await Promise.all([
        Patches.outputs.getScalar("band1"),
        Patches.outputs.getScalar("band2"),
        Patches.outputs.getScalar("band4"),
        Patches.outputs.getScalar("band7"),
        Scene.root.findFirst('frontCameraModelContainer'),
        Scene.root.findFirst('backCameraModelContainer'),
        Textures.findFirst('l1'),
        Textures.findFirst('l2'),
        Textures.findFirst('l3'),
        Textures.findFirst('l4'),
        Textures.findFirst('l5'),
        Textures.findFirst('l6'),
        Textures.findFirst('l7'),       
        Textures.findFirst('lockTexture'),
        Patches.outputs.getBoolean("recording"),
        Scene.root.findFirst('progressBarRectangle'),
        Scene.root.findFirst('confettiYellow'),
        Scene.root.findFirst('confettiGreen'),
        Audio.getAudioPlaybackController('unlockAudioPlaybackController'),
        
    ]);
 
    const soundType = {
        KICK: 0,
        SNARE: 1,
        HIHAT: 2,
        WATERDROP: 3,
    };

    //==============================================================================
    // Native UI Picker variables
    //==============================================================================

    const picker = NativeUI.picker; // Store a reference to Native UI Picker

    // Initialize to Level 1
    let currentSelectedIndex = 0;

    let configuration = {
        selectedIndex: 0,
        items: [
            { image_texture: l1 },
            { image_texture: lockTexture },
            { image_texture: lockTexture },
            { image_texture: lockTexture },
            { image_texture: lockTexture },
            { image_texture: lockTexture },
            { image_texture: lockTexture },
        ]
    };

    // Icons of all levels assigned to an array 
    let levelIcons = [l1, l2, l3, l4, l5, l6, l7];

    // Negated whenever user selects a new item from Native UI picker
    var playIntroChange = false;

    //==============================================================================
    // Persistance variables
    //==============================================================================

    // Store a reference to the userScope
    const userScope = Persistence.userScope;

    // JavaScript object to store the data
    const data = { level: 0 };

    // Max level unlocked by the user
    var maxLevelUnlocked = 0;

    //==============================================================================
    // ProgressBar & Score variables
    //==============================================================================

    //timeDriver to control ProgressBar animation
    var progressBarRectangleDrivers;

    // durationMilliseconds will be set from level data
    var progressBarRectangleDriverParameters = {
        durationMilliseconds: 0,
        loopCount: 1,
        mirror: false
    };

    var progressBarRectangleSampler;

    //Current score value
    var scoreTextValue = 0;

    //=======================================================================================
    // Animation variables of cubeBlock, cylinderBlock, tetrahedronBlock, waterDropBlock
    //=======================================================================================

    // Blocks Animation paramters
    const timeDriverParameters = {
        durationMilliseconds: 4000,
        loopCount: 1,
        mirror: false
    };

    // Animate Blocks in Z Axis, starting at -1.8 and ending at 0.15 in 4 seconds
    const linearSampler = Animation.samplers.linear(-1.8, 0.15);

    // Array to store & access each invidual cubeBlock using index
    const cubes = [];

    // Array to store & access each invidual cylinderBlock using index
    const cylinders = [];

    // Array to store & access each invidual tetrahedronBlock using index
    const tetrahedrons = [];

    // Array to store & access each invidual waterDropBlock using index
    const droplets = [];

    //==============================================================================
    // Time variables
    //==============================================================================

    // Interval timer used to track time
    var intervalTimer;

    //Time elapsed since the user started recording video.
    var timeNow = 0;

    // Similar to timeNow, but store time as String data, rounded to 1 decimal point
    var currentTime;
 

    //==============================================================================
    // Fetch Max Unlocked Level from stored data
    //==============================================================================

    try {
        // Attempt to get the stored data and if successful
        const result = await userScope.get('data');

        // Assign the obtained level data to maxLevelUnlocked
        maxLevelUnlocked = parseInt(result.level.toString());

        Diagnostics.log('Successfully retrieved data ' + result.level);

        // Loop through all the items of Native UI picker and assign respective levelIcons as textures to unlocked levels
        for (let index = 0; index <= result.level; index++) {
            configuration.items[index] = { image_texture: levelIcons[index] };
        }

    } catch (error) {

        // If not successful, then the value of maxLevelUnlocked is its default value which is 0.
        Diagnostics.log('Failed to retrieve data, ' + error);
    }

    // Configure Native UI Picker and display it
    picker.visible = true;
    picker.configure(configuration);

    //==============================================================================
    // Monitor changes to selectedIndex of picker
    //==============================================================================

    picker.selectedIndex.monitor().subscribe(function (selectedIndex) {

        // Value of playIntroChange is negated and sent to the Patch Editor
        playIntroChange = !playIntroChange;
        Patches.inputs.setBoolean("playIntroChange", playIntroChange);

        //Index of newly selected item is assigned
        currentSelectedIndex = selectedIndex.newValue;

        // Value of levelPlayable is determined based on the levels unlocked by the user and sent to the Patch Editor
        Patches.inputs.setBoolean("levelPlayable", currentSelectedIndex <= maxLevelUnlocked ? true : false);

    });

    //Changes to index of newly selected item is sent to the Patch Editor
    Patches.inputs.setScalar("currentLevel", picker.selectedIndex);

    const levelJson = {
        "level_1": {
            "duration": 38000,
            "minscoreText": 25,
            "1.0": ["k"],
            "2.0": ["k"],
            "3.0": ["k"],
            "4.0": ["k"],


            "8.0": ["k"],
            "8.5": ["k"],
            "9.5": ["k"],
            "10.0": ["k"],

            "12.0": ["k"],
            "12.5": ["k"],
            "13.5": ["k"],
            "14.0": ["k"],

            "16.0": ["k"],
            "16.5": ["k"],
            "17.5": ["k"],
            "18.0": ["k"],


            "20.0": ["k"],
            "21.0": ["k"],
            "21.5": ["k"],
            "23.5": ["k"],
            "24.5": ["k"],
            "25.0": ["k"],

            "28.0": ["k"],
            "28.5": ["k"],
            "29.0": ["k"],
            "29.5": ["k"],
            "30.0": ["k"],

            "33.0": ["k"],
            "33.5": ["k"],
            "34.0": ["k"],
            "34.5": ["k"],
            "35.0": ["k"],

        }, "level_2": {
            "duration": 29000,
            "minscoreText": 22,
            "1.0": ["s"],
            "2.0": ["s"],
            "3.0": ["s"],
            "4.0": ["s"],

            "7.0": ["s"],
            "7.5": ["s"],
            "8.5": ["s"],
            "9.0": ["s"],

            "12.0": ["s"],
            "12.5": ["s"],
            "13.5": ["s"],
            "14.0": ["s"],

            "15.0": ["k"],
            "16.0": ["s"],
            "17.0": ["k"],
            "17.5": ["s"],

            "19.0": ["k"],
            "20.0": ["s"],
            "21.0": ["k"],
            "21.5": ["s"],

            "23.0": ["k"],
            "24.0": ["s"],
            "25.0": ["k"],
            "25.5": ["s"],
        },
        "level_3": {
            "duration": 35000,
            "minscoreText": 22,
            "1.0": ["h"],
            "2.0": ["h"],
            "3.0": ["h"],
            "4.0": ["h"],

            "7.0": ["h"],
            "7.5": ["h"],
            "8.5": ["h"],
            "9.0": ["h"],

            "12.0": ["h"],
            "12.5": ["h"],
            "13.5": ["h"],
            "14.0": ["h"],

            "15.0": ["k"],
            "15.5": ["h"],
            "16.5": ["k"],
            "17.0": ["h"],

            "18.0": ["k"],
            "18.5": ["h"],
            "19.5": ["k"],
            "20.0": ["h"],

            "21.0": ["s"],
            "21.5": ["h"],
            "22.5": ["s"],
            "23.0": ["h"],

            "24.0": ["s"],
            "24.5": ["h"],
            "25.5": ["s"],
            "26.0": ["h"],

            "27.5": ["k"],
            "28.0": ["h"],
            "28.5": ["s"],
            "29.0": ["h"],
            "29.5": ["k"],
            "30.0": ["h"],
            "30.5": ["s"],
            "31.0": ["h"],

        },"level_4": {
            "duration": 25000,
            "minscoreText": 25,
            "1.0": ["k"],
            "1.8": ["k"],
            "2.2": ["s"],
            "3.1": ["k"],
            "3.7": ["k"],
            "4.3": ["k"],
            "4.6": ["s"],

            "6.0": ["k"],
            "6.8": ["k"],
            "7.2": ["s"],
            "8.1": ["k"],
            "8.7": ["k"],
            "9.3": ["k"],
            "9.6": ["s"],

            "11.0": ["k"],
            "11.8": ["k"],
            "12.2": ["s"],
            "13.1": ["k"],
            "13.7": ["k"],
            "14.3": ["k"],
            "14.6": ["s"],

            "16.0": ["k"],
            "16.8": ["k"],
            "17.2": ["s"],
            "18.1": ["k"],
            "18.7": ["k"],
            "19.3": ["k"],
            "19.6": ["s"],

        },"level_5": {
            "duration": 20000,
            "minscoreText": 19,
            "2.0": ["k"],
            "2.5": ["k"],
            "3.0": ["s"],
            "3.5": ["k"],
            "4.1": ["k"],
            "4.5": ["s"],

            "5.5": ["k"],
            "6.0": ["s"],
            "6.8": ["k"],
            "7.3": ["k"],
            "7.7": ["s"],

            "9.0": ["k"],
            "9.5": ["k"],
            "10.0": ["s"],
            "10.5": ["k"],
            "11.1": ["k"],
            "11.5": ["s"],

            "12.5": ["k"],
            "13.0": ["s"],
            "13.8": ["k"],
            "14.3": ["k"],
            "14.7": ["s"],

        },
        
        "level_6": {
            "duration": 14000,
            "minscoreText": 4,
            "1.1": ["wd"],
            "3.8": ["wd"],
            "6.5": ["wd"],
            "9.5": ["wd"],


        },"level_7": {
            "duration": 14000,
            "minscoreText": 25,
            "1.0": ["k"],
            "1.5": ["k"],
            "1.8": ["s"],

            "2.5": ["k"],
            "3.0": ["k"],
            "3.3": ["s"],

            "4.0": ["k"],
            "4.5": ["k"],
            "4.8": ["s"],

            "5.5": ["k"],
            "6.0": ["k"],
            "6.3": ["s"],

            "7.0": ["k"],
            "7.5": ["k"],
            "7.8": ["s"],

            "8.5": ["k"],
            "9.0": ["k"],
            "9.3": ["s"],

        }
    }

    //==============================================================================
    // Monitoring Signal Power, Detecting Sounds and Hits
    //==============================================================================

    // KICK DRUM
    // Subscribe to receive events when value of band1(Kick Drum) Signal Power has exceeded threshold value (Condition A)
    band1.gt(0.75).monitor().subscribeWithSnapshot(
        {
            //Check if band1(Kick Drum) Signal Power has not exceeded threshold value (Condition B)
            // Check if band1(Kick Drum) Signal Power was greater than band4(Snare) (Condition C)
            // Check if band1(Kick Drum) Signal Power was greater than band2(Water Drop) (Condition D)
            "greaterThanSnare": band1.gt(band4),
            "snareBelowThreshold": band4.lt(0.75),
            "greaterThanWaterDrop": band1.gt(band2),
        }, function (event, snapshot) {

            // If Condition A, B, C & D are true then it is a confirmation that Kick Drum was detected.
            if (event.newValue  && snapshot.greaterThanSnare && snapshot.snareBelowThreshold && snapshot.greaterThanWaterDrop) {

                // SoundType is set to KICK & sent to the Patch Editor
                Patches.inputs.setScalar("soundType", soundType.KICK);

                //Loop through all the cubes to determine if there is a cube present on top of the platform circle at that very instance
                for (let index = 0; index < cubes.length; index++) {

                    // Obtain the position of the cubeBlock in the Z Axis
                    const z = cubes[index].outputs.getScalarOrFallback("z-position", -1).pinLastValue();

                    //Check if the cubeBlock's z values is within the platform range.
                    if (z > -0.3 && z < -0.1) {

                        //Hit is detected
                        //Update cubeBlock's "hit" variable to true to notify that it was hit.
                        //cubeBlock will use this update to perform hit animation, change visibility of items etc;
                        cubes[index].inputs.setBoolean("hit", true);

                        //Update the score
                        scoreTextValue++;
                        if (scoreTextValue < 10) {
                            scoreText.text = "0" + scoreTextValue;
                        } else {
                            scoreText.text = "" + scoreTextValue;
                        }

                        break;
                    }
                }

                //When condition Condition A, B, C & D are true, rippleStatus is set to true & sent to the Patch Editor
                Patches.inputs.setBoolean("rippleStatus", 1);

            }


            if (!event.newValue) {
                //When condition Condition A is false, rippleStatus is set to true & sent to the Patch Editor
                Patches.inputs.setBoolean("rippleStatus", 0);

            }

        });


    // SNARE        
    band4.gt(0.75).monitor().subscribeWithSnapshot(
        {
            "greaterThanKickDrum": band4.gt(band1),
            "bassBelowThreshold": band1.lt(0.75),
        }, function (event, snapshot) {

            if (event.newValue && snapshot.greaterThanKickDrum && snapshot.bassBelowThreshold) {
                Patches.inputs.setScalar("soundType", soundType.SNARE);

                for (let index = 0; index < tetrahedrons.length; index++) {

                    const z = tetrahedrons[index].outputs.getScalarOrFallback("z-position", -1).pinLastValue();

                    if (z > -0.3 && z < -0.1) {

                        tetrahedrons[index].inputs.setBoolean("hit", true);

                        scoreTextValue++;
                        if (scoreTextValue < 10) {
                            scoreText.text = "0" + scoreTextValue;
                        } else {
                            scoreText.text = "" + scoreTextValue;
                        }

                        break;
                    }
                }

                Patches.inputs.setBoolean("rippleStatus", 1);
            }


            if (!event.newValue) {
                Patches.inputs.setBoolean("rippleStatus", 0);
            }

        });

    // HI-HAT
    band7.gt(0.6).monitor().subscribeWithSnapshot(
        {
            "snareBelowThreshold": band4.lt(0.75),
            "energy": band7
        }
        , function (event, snapshot) {

            if (event.newValue && snapshot.snareBelowThreshold) {

                Patches.inputs.setScalar("soundType", soundType.HIHAT);

                for (let index = 0; index < cylinders.length; index++) {

                    const z = cylinders[index].outputs.getScalarOrFallback("z-position", -1).pinLastValue();

                    if (z > -0.3 && z < -0.1) {

                        cylinders[index].inputs.setBoolean("hit", true);

                        scoreTextValue++;
                        if (scoreTextValue < 10) {
                            scoreText.text = "0" + scoreTextValue;
                        } else {
                            scoreText.text = "" + scoreTextValue;
                        }

                        break;
                    }
                }

                Patches.inputs.setBoolean("rippleStatus", 1);
            }

            if (!event.newValue) {
                Patches.inputs.setBoolean("rippleStatus", 0);
            }

        });


    // WATER DROP
    band2.gt(0.6).monitor().subscribeWithSnapshot(
        {
            "greaterThanKickDrum": band2.gt(band1),
            "greaterThanSnare": band2.gt(band4),
            "snareBelowThreshold": band4.lt(0.75),
        }
        , function (event, snapshot) {

            if (event.newValue && snapshot.greaterThanKickDrum && snapshot.greaterThanSnare && snapshot.snareBelowThreshold) {

                Patches.inputs.setScalar("soundType", soundType.WATERDROP);

                for (let index = 0; index < droplets.length; index++) {

                    const z = droplets[index].outputs.getScalarOrFallback("z-position", -1).pinLastValue();

                    if (z > -0.3 && z < -0.1) {

                        droplets[index].inputs.setBoolean("hit", true);

                        scoreTextValue++;
                        if (scoreTextValue < 10) {
                            scoreText.text = "0" + scoreTextValue;
                        } else {
                            scoreText.text = "" + scoreTextValue;
                        }

                        break;
                    }
                }

                Patches.inputs.setBoolean("rippleStatus", 1);
            }

            if (!event.newValue) {
                Patches.inputs.setBoolean("rippleStatus", 0);
            }

        });

    //==============================================================================
    // Monitor whether the user is recording video
    //==============================================================================

    recording.monitor().subscribe(function (recordingEvent, snapshot) {

        // Value of levelPlayable is determined based on the levels unlocked by the user and sent to the Patch Editor
        Patches.inputs.setBoolean("levelPlayable", currentSelectedIndex <= maxLevelUnlocked ? true : false);

        //Allow the user to proceed and play if the user has unlocked the selected level
        if (currentSelectedIndex <= maxLevelUnlocked) {
            //Allow user to proceed and play if the user has started recording video
            if (recordingEvent.newValue) {

                //==============================================================================
                // Reset UI & AudioPlaybackController
                //==============================================================================

                // Reset Confetti and hide them
                confettiYellow.birthrate = 0;
                confettiGreen.birthrate = 0;
                confettiYellow.hidden = true;
                confettiGreen.hidden = true;

                //Stop playing Level Unlock Music from previous levels
                unlockAudioPlaybackController.setPlaying(false);

                //Hide the Native UI Picker and rest score to 00
                picker.visible = false;
                scoreTextValue = 0;
                scoreText.text = "00";

                //==============================================================================
                // Prepare ProgressBar & start its Animation
                //==============================================================================

                // Configure the duration of progressBar to go from 100 to 0 based on the level   
                progressBarRectangleDriverParameters.durationMilliseconds = levelJson["level_" + (currentSelectedIndex + 1)].duration;
                progressBarRectangleDrivers = Animation.timeDriver(progressBarRectangleDriverParameters);
                progressBarRectangleSampler = Animation.samplers.linear(100, 0);
                progressBarRectangle.width = Animation.animate(progressBarRectangleDrivers, progressBarRectangleSampler)
                progressBarRectangleDrivers.reset();
                progressBarRectangleDrivers.start();

                //Unhide progressBar
                progressBarRectangle.hidden = false;

                //Initialize Time to 0    
                timeNow = 0;

                //==============================================================================
                // Begin Selected Level
                //============================================================================== 

                //Interval timer to execute function every 0.1 sec or 100 ms
                intervalTimer = Time.setInterval(function () {

                    //Increase time by 0.1 because the function is called every 0.1 sec
                    timeNow = timeNow + 0.1;

                    //Round off timeNow to 1 decimal point Ex : 1.59 becomes 1.5
                    currentTime = timeNow.toFixed(1);

                    //Check if levelJson has any sounds at a specific time. Ex : levelJson["level_1"][1.5]
                    if (levelJson["level_" + (currentSelectedIndex + 1)][currentTime]) {

                        Diagnostics.log("level" + levelJson["level_" + (currentSelectedIndex + 1)][currentTime] + "")

                        // Loop through all the sounds present at a specific time Ex: "1.0": ["k","h"]
                        levelJson["level_" + (currentSelectedIndex + 1)][currentTime].forEach(sound => {

                            // Based on the sound data from levelJson animate a cube/cylinder/tetrahedron.
                            switch (sound) {
                                case "k":

                                    //Dynamically Instantiate cubeBlock
                                    Blocks.instantiate('cubeBlock').then(function (block) {
                                        
                                        // Create a new TimeDriver
                                        const timeDriver = Animation.timeDriver(timeDriverParameters);

                                        // Create a new animation using the TimeDriver &  linearSampler. 
                                        // Bind it to the z-position signal of the cubeBlock
                                        block.inputs.setScalar("z-position", Animation.animate(timeDriver, linearSampler))
                                        
                                        //Start the Animation
                                        timeDriver.start();
                                        
                                        //Based on the value of frontCamera, add cubeBlock as a child to frontCameraModelContainer/backCameraModelContainer
                                        frontCamera ? frontCameraModelContainer.addChild(block) : backCameraModelContainer.addChild(block);
                                        
                                        //Store referece to the newly created cubeBlock
                                        cubes.push(block)

                                        // Once the animation it completed
                                        timeDriver.onCompleted().subscribe(function (event) {

                                            //Destroy the cubeBlock
                                            Scene.destroy(block);

                                            //Remove it from the array
                                            cubes.shift()

                                        });

                                    });

                                    break;

                                case "h":

                                    Blocks.instantiate('cylinderBlock').then(function (block) {

                                        const timeDriver = Animation.timeDriver(timeDriverParameters);
                                        block.inputs.setScalar("z-position", Animation.animate(timeDriver, linearSampler))

                                        timeDriver.start();
                                        frontCamera ? frontCameraModelContainer.addChild(block) : backCameraModelContainer.addChild(block);
                                        cylinders.push(block)

                                        timeDriver.onCompleted().subscribe(function (event) {

                                            Scene.destroy(block);
                                            cylinders.shift()

                                        });

                                    });

                                    break;

                                case "s":

                                    Blocks.instantiate('tetrahedronBlock').then(function (block) {

                                        const timeDriver = Animation.timeDriver(timeDriverParameters);
                                        block.inputs.setScalar("z-position", Animation.animate(timeDriver, linearSampler))

                                        timeDriver.start();
                                        frontCamera ? frontCameraModelContainer.addChild(block) : backCameraModelContainer.addChild(block);
                                        tetrahedrons.push(block)

                                        timeDriver.onCompleted().subscribe(function (event) {

                                            Scene.destroy(block);
                                            tetrahedrons.shift()

                                        });

                                    });

                                    break;


                                case "wd":

                                    Blocks.instantiate('waterDropBlock').then(function (block) {

                                        const timeDriver = Animation.timeDriver(timeDriverParameters);
                                        block.inputs.setScalar("z-position", Animation.animate(timeDriver, linearSampler))

                                        timeDriver.start();
                                        frontCamera ? frontCameraModelContainer.addChild(block) : backCameraModelContainer.addChild(block);
                                        droplets.push(block)

                                        timeDriver.onCompleted().subscribe(function (event) {

                                            Scene.destroy(block);
                                            droplets.shift()

                                        });

                                    });

                                    break;
                            }
                        });
                    }

                    //==============================================================================
                    // End Selected Level if currentTime has exceeded the duration of the level
                    //============================================================================== 

                    // Check if currentTime has crossed the duration of the selected level
                    if ((parseFloat(currentTime) * 1000) > levelJson["level_" + (currentSelectedIndex + 1)].duration) {

                        //Clear Timer to end level
                        Time.clearInterval(intervalTimer);

                        //Hide the progressBar & Native UI picker
                        progressBarRectangle.hidden = true;
                        picker.visible = true;

                        // Stop the progressBar's animation
                        progressBarRectangleDrivers.stop();

                        // Check if the user has scored the minimum points required to unlock the next level
                        if (scoreTextValue >= levelJson["level_" + (currentSelectedIndex + 1)].minscoreText) {

                            // Update Persistance data if the next level has been unlocked

                            try {
                                maxLevelUnlocked = currentSelectedIndex + 1;
                                data.level = maxLevelUnlocked;
                                userScope.set('data', data);

                            } catch (error) {
                                // If not successful output a failure message with the error returned
                                Diagnostics.log('Failed to store, ' + error)
                            }

                            //Assign the respective levelIcon to the unlocked level item and update the Native UI Picker
                            configuration.items[currentSelectedIndex + 1].image_texture = levelIcons[currentSelectedIndex + 1];
                            configuration.selectedIndex = currentSelectedIndex;
                            picker.configure(configuration);

                            //Play unlock level audio
                            unlockAudioPlaybackController.reset();
                            unlockAudioPlaybackController.setPlaying(true);

                            //Unhide the confetti and increase its birthrate.
                            confettiYellow.hidden = false;
                            confettiGreen.hidden = false;
                            confettiYellow.birthrate = 30;
                            confettiGreen.birthrate = 30;

                        }

                    }

                }, 100);


            } else {

                //==============================================================================
                // End selected Level if user stops recording video
                //============================================================================== 

                //Clear Timer to end level
                Time.clearInterval(intervalTimer);

                //Hide the progressBar & Native UI picker
                picker.visible = true;
                progressBarRectangle.hidden = true;

                // Stop the progressBar's animation
                progressBarRectangleDrivers.stop();

                // Check if the user has scored the minimum points required to unlock the next level
                if (scoreTextValue >= levelJson["level_" + (currentSelectedIndex + 1)].minscoreText) {

                    //Assign the respective levelIcon to the unlocked level item and update the Native UI Picker
                    picker.configure(configuration);

                    //Play unlock level audio
                    unlockAudioPlaybackController.reset();
                    unlockAudioPlaybackController.setPlaying(true);

                    //Unhide the confetti and increase its birthrate.
                    confettiYellow.hidden = false;
                    confettiGreen.hidden = false;
                    confettiYellow.birthrate = 30;
                    confettiGreen.birthrate = 30;

                }

            }
        }
    });

    //==============================================================================
    // Monitor whether the user is using front/back camera
    //==============================================================================

    CameraInfo.captureDevicePosition.monitor({ fireOnInitialValue: true }).subscribe(function (event) {

        //Set value of frontCamera
        (event.newValue == "FRONT") ? frontCamera = true : frontCamera = false;

        //Remove cameraPlatformItems from it's previous parent(frontCameraPlatform/backCameraPlatform)
        instantiated?cameraPlatformItems.removeFromParent():"";

        //Update reference stored in scoreText based on the value of frontCamera
        frontCamera ? scoreText = frontCameraScoreText : scoreText = backCameraScoreText ;

        //Add cameraPlatformItems as child of frontCameraPlatform / backCameraPlatform based on the value of frontCamera
        frontCamera ? frontCameraPlatform.addChild(cameraPlatformItems) : backCameraPlatform.addChild(cameraPlatformItems)
        
        //(Optional) Update properties of gridPlane based on the value of frontCamera.
        frontCamera ? gridPlane.transform.y = 0.1 : gridPlane.transform.y = 0.5;
        frontCamera ? gridPlane.transform.scaleX = 12 : gridPlane.transform.scaleX = 6;
        frontCamera ? gridPlane.transform.scaleY = 24 : gridPlane.transform.scaleY = 16;
        
        //Check if the objects were not instantiated before
        if (!instantiated) {
            
            //set instantiated to true so that we don't have to instantiate again.
            instantiated = true;

            //Set properties & material of gridPlane
            gridPlane.transform.z = -0.22;
            gridPlane.transform.scaleZ = 1;
            gridPlane.material = gridMaterial;

            //Set properties & material of kickDrumHitCircle, hiHatHitCircle, snareHitCircle
            kickDrumHitCircle.transform.y = -0.2;
            kickDrumHitCircle.transform.z = -0.21;
            kickDrumHitCircle.transform.scaleX = 1.8;
            kickDrumHitCircle.transform.scaleY = 1.8;
            kickDrumHitCircle.transform.scaleZ = 1.8;
            kickDrumHitCircle.material = circleMaterial;

            hiHatHitCircle.transform.x = -0.1;
            hiHatHitCircle.transform.y = -0.2;
            hiHatHitCircle.transform.z = -0.21;
            hiHatHitCircle.transform.scaleX = 1.8;
            hiHatHitCircle.transform.scaleY = 1.8;
            hiHatHitCircle.transform.scaleZ = 1.8;
            hiHatHitCircle.material = circleMaterial;

            snareHitCircle.transform.x = 0.1;
            snareHitCircle.transform.y = -0.2;
            snareHitCircle.transform.z = -0.21;
            snareHitCircle.transform.scaleX = 1.8;
            snareHitCircle.transform.scaleY = 1.8;
            snareHitCircle.transform.scaleZ = 1.8;
            snareHitCircle.material = circleMaterial;

            kickDrumHitCircleGlow.transform.x = 0;
            kickDrumHitCircleGlow.transform.y = -0.2;
            kickDrumHitCircleGlow.transform.z = -0.21;
            kickDrumHitCircleGlow.transform.scaleX = 2;
            kickDrumHitCircleGlow.transform.scaleY = 2;
            kickDrumHitCircleGlow.transform.scaleZ = 2;
            kickDrumHitCircleGlow.material = kickDrumCircleGlowMaterial;

            hiHatHitCircleGlow.transform.x = -0.09;
            hiHatHitCircleGlow.transform.y = -0.2;
            hiHatHitCircleGlow.transform.z = -0.21;
            hiHatHitCircleGlow.transform.scaleX = 2;
            hiHatHitCircleGlow.transform.scaleY = 2;
            hiHatHitCircleGlow.transform.scaleZ = 2;
            hiHatHitCircleGlow.material = hiHatHitCircleGlowMaterial;

            snareHitCircleGlow.transform.x = 0.09;
            snareHitCircleGlow.transform.y = -0.2;
            snareHitCircleGlow.transform.z = -0.21;
            snareHitCircleGlow.transform.scaleX = 2;
            snareHitCircleGlow.transform.scaleY = 2;
            snareHitCircleGlow.transform.scaleZ = 2;
            snareHitCircleGlow.material = snareHitCircleGlowMaterial;

            //Add all the instantiated objects as a children of cameraPlatformItems
            cameraPlatformItems.addChild(gridPlane);
            cameraPlatformItems.addChild(kickDrumHitCircle);
            cameraPlatformItems.addChild(hiHatHitCircle);
            cameraPlatformItems.addChild(snareHitCircle);
            cameraPlatformItems.addChild(kickDrumHitCircleGlow);
            cameraPlatformItems.addChild(hiHatHitCircleGlow);
            cameraPlatformItems.addChild(snareHitCircleGlow);


        }


    });

})();
