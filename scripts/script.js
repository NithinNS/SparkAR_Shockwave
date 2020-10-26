
const Time = require('Time'); // To keep track of Time and trigger animations accordingly
const Audio = require('Audio'); // To play Level Unlock Audio
const Scene = require('Scene'); // To import Scene Elements 
const Patches = require('Patches'); // To exchange data between to Patch Editor and Script
const NativeUI = require('NativeUI'); // To create Native UI Picker
const Textures = require('Textures'); //  To import textures required by Native UI Picker 
const Animation = require('Animation'); // To Animate cubes, cylinders & tetrahedrons
const Materials = require('Materials'); // To import hit Materials 
const Persistence = require('Persistence'); // To store max level unlocked by the user
export const Diagnostics = require('Diagnostics'); // To debug code
 
(async function () {

    // Import all the required Scene objects, Textures, AudioPlaybackController, Materials and Variables passed from Patch Editor
    const [cube1, cube2, cube3, cube4, cube5, cylinder1, cylinder2, cylinder3, cylinder4, cylinder5, tetrahedron1, tetrahedron2, tetrahedron3, tetrahedron4, tetrahedron5, band1, band4, band7, scoreText, l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, lockTexture, recording, progressBarRectangle, confettiYellow, confettiGreen, unlockAudioPlaybackController, kickDrumMaterial,snareMaterial,hiHatMaterial, kickDrumHitMaterial,snareHitMaterial,hiHatHitMaterial] = await Promise.all([
        Scene.root.findFirst('cube1'),
        Scene.root.findFirst('cube2'),
        Scene.root.findFirst('cube3'),
        Scene.root.findFirst('cube4'),
        Scene.root.findFirst('cube5'),
        Scene.root.findFirst('cylinder1'),
        Scene.root.findFirst('cylinder2'),
        Scene.root.findFirst('cylinder3'),
        Scene.root.findFirst('cylinder4'),
        Scene.root.findFirst('cylinder5'),
        Scene.root.findFirst('tetrahedron1'),
        Scene.root.findFirst('tetrahedron2'),
        Scene.root.findFirst('tetrahedron3'),
        Scene.root.findFirst('tetrahedron4'),
        Scene.root.findFirst('tetrahedron5'),
        Patches.outputs.getScalar("band1"),
        Patches.outputs.getScalar("band4"),
        Patches.outputs.getScalar("band7"),
        Scene.root.findFirst('scoreText'),
        Textures.findFirst('l1'),
        Textures.findFirst('l2'),
        Textures.findFirst('l3'),
        Textures.findFirst('l4'),
        Textures.findFirst('l5'),
        Textures.findFirst('l6'),
        Textures.findFirst('l7'),
        Textures.findFirst('l8'),
        Textures.findFirst('l9'),
        Textures.findFirst('l10'),
        Textures.findFirst('lockTexture'),
        Patches.outputs.getBoolean("recording"),
        Scene.root.findFirst('progressBarRectangle'),
        Scene.root.findFirst('confettiYellow'),
        Scene.root.findFirst('confettiGreen'),
        Audio.getAudioPlaybackController('unlockAudioPlaybackController'),
        Materials.findFirst("kickDrumMaterial"),
        Materials.findFirst("snareMaterial"),
        Materials.findFirst("hiHatMaterial"),
        Materials.findFirst("kickDrumHitMaterial"),
        Materials.findFirst("snareHitMaterial"),
        Materials.findFirst("hiHatHitMaterial"),

    ]);
 
    const soundType = {
        KICK: 0,
        SNARE: 1,
        HIHAT: 2,
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
            { image_texture: lockTexture },
            { image_texture: lockTexture },
            { image_texture: lockTexture }
        ]
    };

    // Icons of all levels assigned to an array 
    let levelIcons = [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10]; 
    
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

    //==============================================================================
    // Cube, Cylinder & Tetrahedron Animation variables
    //==============================================================================
 
    // 3D objects Animation paramters
    const timeDriverParameters = {
        durationMilliseconds: 4000,
        loopCount: 1,
        mirror: false
    };

    // Animate 3D objects in Z Axis, starting at -1.8 and ending at 0.15 in 4 seconds
    const linearSampler = Animation.samplers.linear(-1.8, 0.15);

    // Array to store & access cubeTimeDrivers of each invidual cube, cylinder & tetrahedron using index
    let cubeTimeDrivers = []; 
    let cylindersTimeDrivers = [];
    let tetrahedronsTimeDrivers = [];
    
    // Array to store & access each invidual cube using index
    const cubes = [cube1, cube2, cube3, cube4, cube5];  
    // Array to track Availability of cubes
    const cubesAvailability = [true, true, true, true, true]; 

    // Array to store & access each invidual cylinder using index
    const cylinders = [cylinder1, cylinder2, cylinder3, cylinder4, cylinder5]; 
    // Array to track Availability of cylinders
    const cylindersAvailability = [true, true, true, true, true];

    // Array to store & access each invidual tetrahedron using index
    const tetrahedrons = [tetrahedron1, tetrahedron2, tetrahedron3, tetrahedron4, tetrahedron5];
    // Array to track Availability of tetrahedrons
    const tetrahedronsAvailability = [true, true, true, true, true];
 
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
        Patches.inputs.setBoolean("playIntroChange",playIntroChange);

        //Index of newly selected item is assigned
        currentSelectedIndex = selectedIndex.newValue;
 
        // Value of levelPlayable is determined based on the levels unlocked by the user and sent to the Patch Editor
        Patches.inputs.setBoolean("levelPlayable",currentSelectedIndex <= maxLevelUnlocked?true:false);
 
    });

    //Changes to index of newly selected item is sent to the Patch Editor
    Patches.inputs.setScalar("currentLevel", picker.selectedIndex);

    const levelJson = {
        "level_5": {
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
        },
        "level_2": {
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
            
        },
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
        }
    }

    //==============================================================================
    // Monitoring Signal Power, Detecting Sounds and Hits
    //==============================================================================
    
    // KICK DRUM
    // Subscribe to receive events when value of band1(Kick Drum) Signal Power has exceeded threshold value (Condition A)
    band1.gt(0.75).monitor().subscribeWithSnapshot(
        {
            // Check if band1(Kick Drum) Signal Power was greater than band4(Snare)  (Condition B)
            // Check if band1(Kick Drum) Signal Power has not exceeded threshold value (Condition C)
            "greaterThanSnare": band1.gt(band4),
            "snareBelowThreshold": band4.lt(0.75)
        }, function (event, snapshot) {

            // If Condition A, B & C are true then it is a confirmation that Kick Drum was detected.
            if (event.newValue && snapshot.greaterThanSnare && snapshot.snareBelowThreshold) {
                 
                // SoundType is set to KICK & sent to the Patch Editor
                Patches.inputs.setScalar("soundType",soundType.KICK);
 
                //Loop through all the cubes to determine if there is a cube present on top of the platform circle at that very instance
                for (let index = 0; index < cubes.length; index++) {

                    // Obtain the position of the cubes in the Z Axis
                    const z = cubes[index].transform.z.pinLastValue();

                    //Check if the cube's z values is within the platform range.
                    if (z > -0.3 && z < -0.1) {

                        // Hit is detected
                        // Reduce the scale of cube and change its material
                        Diagnostics.log("hit" + index + " " + z)
                        
                        cubes[index].transform.scaleX = 0.4;
                        cubes[index].transform.scaleY = 0.4;

                        cubes[index].material = kickDrumHitMaterial;

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

                //When condition Condition A, B & C are true, rippleStatus is set to true & sent to the Patch Editor
                Patches.inputs.setBoolean("rippleStatus",1);

            }

            
            if(!event.newValue)
            {   
                //When condition Condition A is false, rippleStatus is set to true & sent to the Patch Editor
                Patches.inputs.setBoolean("rippleStatus",0);

            }

        });


    // SNARE        
    band4.gt(0.75).monitor().subscribeWithSnapshot(
        {
            "greaterThanBass": band4.gt(band1),
            "bassBelowThreshold": band1.lt(0.75)
        }, function (event, snapshot) {

            if (event.newValue && snapshot.greaterThanBass && snapshot.bassBelowThreshold) {
                Patches.inputs.setScalar("soundType",soundType.SNARE);
 
                for (let index = 0; index < tetrahedrons.length; index++) {

                    const z = tetrahedrons[index].transform.z.pinLastValue();

                    if (z > -0.3 && z < -0.1) {
                        Diagnostics.log("hit" + index + " " + z)

                        tetrahedrons[index].transform.scaleX = 0.7;
                        tetrahedrons[index].transform.scaleY = 0.7;

                        tetrahedrons[index].material = snareHitMaterial;
                        scoreTextValue++;
                        if (scoreTextValue < 10) {
                            scoreText.text = "0" + scoreTextValue;
                        } else {
                            scoreText.text = "" + scoreTextValue;
                        }

                        break;
                    }
                }

                Patches.inputs.setBoolean("rippleStatus",1);

            }

            
            if(!event.newValue)
            {
                Patches.inputs.setBoolean("rippleStatus",0);

            }

        });

    // HI-HAT
    band7.gt(0.6).monitor().subscribeWithSnapshot(
        {
            "snareBelowThreshold": band4.lt(0.75)
        }
        , function (event, snapshot) {

            if (event.newValue && snapshot.snareBelowThreshold) {
                
                Patches.inputs.setScalar("soundType",soundType.HIHAT);
                
                for (let index = 0; index < cylinders.length; index++) {

                    const z = cylinders[index].transform.z.pinLastValue();

                    if (z > -0.3 && z < -0.1) {
                        Diagnostics.log("hit" + index + " " + z)    
                        
                        cylinders[index].transform.scaleX = 0.4;
                        cylinders[index].transform.scaleZ = 0.4;

                        cylinders[index].material = hiHatHitMaterial;
                        scoreTextValue++;
                        if (scoreTextValue < 10) {
                            scoreText.text = "0" + scoreTextValue;
                        } else {
                            scoreText.text = "" + scoreTextValue;
                        }

                        break;
                    }
                }

                Patches.inputs.setBoolean("rippleStatus",1);

            }

            if(!event.newValue)
            {
                Patches.inputs.setBoolean("rippleStatus",0);

            }

        });
 
    
    //==============================================================================
    // Monitor whether the user is recording video
    //==============================================================================
   
    recording.monitor().subscribe(function (recordingEvent, snapshot) {
        
        // Value of levelPlayable is determined based on the levels unlocked by the user and sent to the Patch Editor
        Patches.inputs.setBoolean("levelPlayable",currentSelectedIndex <= maxLevelUnlocked?true:false);

        //Allow the user to proceed and play if the user has unlocked the selected level
        if( currentSelectedIndex <= maxLevelUnlocked)
        {
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
            progressBarRectangleDriverParameters.durationMilliseconds = levelJson["level_" + (currentSelectedIndex+1)].duration;
            progressBarRectangleDrivers = Animation.timeDriver(progressBarRectangleDriverParameters);
            progressBarRectangleSampler = Animation.samplers.linear(100, 0);
            progressBarRectangle.width = Animation.animate(progressBarRectangleDrivers, progressBarRectangleSampler)
            progressBarRectangleDrivers.reset();
            progressBarRectangleDrivers.start();

            //Unhide progressBar
            progressBarRectangle.hidden = false;
            
            //==============================================================================
            // Initialize Animation Drivers
            //==============================================================================
 
                // Check array length to determine if the driver was previously initialized
                if (cubeTimeDrivers.length == 0) {

                    // Loop through all the cubes
                    for (let index = 0; index < cubes.length; index++) {

                        // Create a new TimeDriver and push it into the array 
                        cubeTimeDrivers.push(Animation.timeDriver(timeDriverParameters))
                        
                        // Create a new animation using the TimeDrivers &  linearSampler. 
                        // Bind it to the z-axis position signal of the cube
                        cubes[index].transform.z = Animation.animate(cubeTimeDrivers[index], linearSampler)
                        
                        // Hide the cube until the animation begins
                        cubes[index].hidden = true;

                        // Once the animation it completed, 
                        // Reset the availability to true
                        // Reset to original scale, material and hide it
                        cubeTimeDrivers[index].onCompleted().subscribe(function (event) {
                            cubesAvailability[index] = true;
                            cubes[index].transform.scaleX = 0.5;
                            cubes[index].transform.scaleY = 0.5;
                            cubes[index].material = kickDrumMaterial;
                            cubes[index].hidden = true;

                        });

                    }

                    // Loop through all the cylinders
                    for (let index = 0; index < cylinders.length; index++) {

                        // Create a new TimeDriver and push it into the array 
                        cylindersTimeDrivers.push(Animation.timeDriver(timeDriverParameters))
                        
                        // Create a new animation using the TimeDrivers &  linearSampler. 
                        // Bind it to the z-axis position signal of the cylinder
                        cylinders[index].transform.z = Animation.animate(cylindersTimeDrivers[index], linearSampler)
                        
                        // Hide the cube until the animation begins
                        cylinders[index].hidden = true;

                        // Once the animation it completed, 
                        // Reset the availability to true
                        // Reset to original scale, material and hide it
                        cylindersTimeDrivers[index].onCompleted().subscribe(function (event) {
                            cylindersAvailability[index] = true;
                            cylinders[index].transform.scaleX = 0.5;
                            cylinders[index].transform.scaleY = 0.3;
                            cylinders[index].material = hiHatMaterial;
                            cylinders[index].hidden = true;

                        });

                    }

                    // Loop through all the tetrahedrons
                    for (let index = 0; index < tetrahedrons.length; index++) {

                        // Create a new TimeDriver and push it into the array 
                        tetrahedronsTimeDrivers.push(Animation.timeDriver(timeDriverParameters))
                        
                        // Create a new animation using the TimeDrivers &  linearSampler. 
                        // Bind it to the z-axis position signal of the tetrahedron
                        tetrahedrons[index].transform.z = Animation.animate(tetrahedronsTimeDrivers[index], linearSampler)
                        
                        // Hide the cube until the animation begins
                        tetrahedrons[index].hidden = true;
                        
                        // Once the animation it completed, 
                        // Reset the availability to true
                        // Reset to original scale, material and hide it
                        tetrahedronsTimeDrivers[index].onCompleted().subscribe(function (event) {
                            tetrahedronsAvailability[index] = true;
                            tetrahedrons[index].transform.scaleX = 0.8;
                            tetrahedrons[index].transform.scaleZ = 0.8;
                            tetrahedrons[index].material = snareMaterial;
                            tetrahedrons[index].hidden = true;

                        });

                    }

                }    
             
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
                    if (levelJson["level_" + (currentSelectedIndex+1)][currentTime]) {
    
                        // Loop through all the sounds present at a specific time Ex: "1.0": ["k","h"]
                        levelJson["level_" + (currentSelectedIndex+1)][currentTime].forEach(sound => {
                             
                            let availableIndex;
    
                            // Based on the sound data from levelJson animate a cube/cylinder/tetrahedron.
                            switch (sound) {
                                case "k":
                                    
                                    //Locate the index of the first available cube
                                    availableIndex = cubesAvailability.indexOf(true);

                                    //Make it visible
                                    cubes[availableIndex].hidden = false;

                                    //Make it unavailable by setting its availability to false
                                    cubesAvailability[availableIndex] = false;

                                    //Start the Animation
                                    cubeTimeDrivers[availableIndex].reset();
                                    cubeTimeDrivers[availableIndex].start();
    
                                    break;
    
                                case "h":
    
                                    availableIndex = cylindersAvailability.indexOf(true);
                                    cylinders[availableIndex].hidden = false;
                                    cylindersAvailability[availableIndex] = false;
                                    cylindersTimeDrivers[availableIndex].reset();
                                    cylindersTimeDrivers[availableIndex].start();
    
                                    break;
    
                                case "s":
    
                                    availableIndex = tetrahedronsAvailability.indexOf(true);
                                    tetrahedrons[availableIndex].hidden = false;
                                    tetrahedronsAvailability[availableIndex] = false;
                                    tetrahedronsTimeDrivers[availableIndex].reset();
                                    tetrahedronsTimeDrivers[availableIndex].start();
    
                                    break;
                                
                            }
                        });
                    }
    
                    //==============================================================================
                    // End Selected Level if currentTime has exceeded the duration of the level
                    //============================================================================== 
            
                    // Check if currentTime has crossed the duration of the selected level
                    if ((parseFloat(currentTime) * 1000) > levelJson["level_" + (currentSelectedIndex+1)].duration) {

                        //Clear Timer to end level
                        Time.clearInterval(intervalTimer);

                        //Hide the progressBar & Native UI picker
                        progressBarRectangle.hidden = true;
                        picker.visible = true;

                        // Stop the progressBar's animation
                        progressBarRectangleDrivers.stop();
                        
                        // Check if the user has scored the minimum points required to unlock the next level
                        if (scoreTextValue >= levelJson["level_" + (currentSelectedIndex+1)].minscoreText) {
                            
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
                if (scoreTextValue >= levelJson["level_" + (currentSelectedIndex+1)].minscoreText) {
                    
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
 
})();
