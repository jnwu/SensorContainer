
var physics;
var level;
var cars = [];
var carsInit = [];
function addTruck() {
    // load and initialize the vehicle
    var car = loadVehicle("models/collada/truck/truck_L200.dae","models/collada/truck/","truck1","truck1Collision"); 
	cars.push(car);
	carsInit.push(false);
}


// accelerometer handler 
var steer = 0;
var gas = 0;
var brake = 0;
var canvasCallback = function (param) {
	if(param != null) {
		var x, y, z, speech;
		
		var motion = param['accel'];
		if(motion == null)
			motion = param['audio'];
		
		if(motion == null)
			return;
		
		if(motion.length == 3) {
			x = motion[0];
			y = motion[1];
			z = motion[2];
		} else if(motion.length == 2) {
			speech = motion[1];
		}
		
		if(speech == "add truck") {
			addTruck();
			return;
		}
		
		// check if x is between -0.1 and 0.1, z is between -0.9 and -1.1, stop
		// flat position
		if(((x > -0.1 && x < 0.1) && (z > -1.1 && z < -0.9)) || speech == "stop") {
			brake = 10000;
			steer = 0;
			gas = 0;
			return;
		}
	
		// check if x is between -1.1 and -0.9, z is between -0.1 and 0.1, stop
		// left sideways position
		if((x > -1.1 && x < -0.9) && (z > -0.1 && z < 0.1)) {
			brake = 10000;
			steer = 0;
			gas = 0;
			return;
		}
	
		// turn left
		if((y > 0.15 && y < 0.75) || speech == "left") {
			brake = 0;
			steer = 1;
		} else {
			steer = 0;
		}

		// turn right
		if((y < -0.15 && y > -0.75) || speech == "right") {
			brake = 0;
			steer = -1;
		} else if(!steer){
			steer = 0;
		}	

		// check if x is less than -0.5 and z is greater than -0.5, forward
		if((z < -0.1 && z > -0.9) || speech == "go"){
			brake = 0;
			gas = 1;
			return;
		}
					
		// check if x is greater than -0.5 and z is less than -0.5, reverse
		if((z > 0.1 && z < 0.9) || speech == "reverse") {
			brake = 0;
			gas = -1;
			return;
		}
	}
}


function webGLStart() {
    // by default generate a full screen canvas with automatic resize
    var gl = CubicVR.init();
    var canvas = CubicVR.getCanvas();

    if (!gl) {
        alert("Sorry, no WebGL support.");
        return;
    };

    CubicVR.setSoftShadows(true);
    CubicVR.setGlobalAmbient([0.2,0.2,0.2]);

     // init physics manager
    physics = new CubicVR.ScenePhysics();
    var level = new GameLevel("models/collada/track/track1.dae","models/collada/track/");
    
    scene = level.getLevel();
    scene.lights = [];
    scene.setSkyBox(new CubicVR.SkyBox({texture:"images/cubemap1.jpg"}));

    var camera = new CubicVR.Camera({
            width: canvas.width, 
            height: canvas.height, 
            fov: 70,
            farclip: 1000,
            position: [15, 4, 15],
            target: [0, -3, 0]
        });
    scene.setCamera(camera);

    var light = new CubicVR.Light({
          type: "area",
          intensity: 0.8,
          color: [0.8,0.8,0.95],
          mapRes: 2048,
          areaCeiling: 80,
          areaFloor: -10,
          areaAxis: [-5,-2], // specified in degrees east/west north/south
          distance: 120
        });                
        
    scene.bind(light);
    level.setupRigidBody(physics);
    
    // load and init car
    var car = loadVehicle("models/collada/sportscar/car1.dae","models/collada/sportscar/","car1","car1Collision");
	cars.push(car);
	carsInit.push(true);
	
    car.getSceneObject().position = level.getPlayerStart();
    car.getSceneObject().position[2] -= 3.5;
    car.getSceneObject().rotation = level.getPlayerStartRotation();

    scene.bind(car);
    physics.bind(car);
    mvc = new CubicVR.MouseViewController(canvas, scene.camera);
    CubicVR.addResizeable(scene);

	this.vehicle = car; 
    var pickConstraint = null;
    var pickDist = 0;
 
    mvc.setEvents({
        mouseMove: function (ctx, mpos, mdelta, keyState) {
            if (!ctx.mdown) return;
            if (pickConstraint) {
                pickConstraint.setPosition(scene.camera.unProject(mpos[0],mpos[1],pickDist));
            } else {                   
                ctx.orbitView(mdelta);
            }
        },
        mouseDown: function (ctx, mpos, keyState) {
          var rayTo = scene.camera.unProject(mpos[0],mpos[1]);
          var result = physics.getRayHit(scene.camera.position,rayTo);

          if (result && !pickConstraint) {
            pickConstraint = new CubicVR.Constraint({
                type: CubicVR.enums.physics.constraint.P2P,
                rigidBody: result.rigidBody,
                positionA: result.localPosition
            });                        
            
            physics.addConstraint(pickConstraint);                       
            pickDist = CubicVR.vec3.length(CubicVR.vec3.subtract(scene.camera.position,result.position));                        
            pickConstraint.setPosition(scene.camera.unProject(mpos[0],mpos[1],pickDist));
          }
          
        },
        mouseUp: function(ctx, mpos, keyState) {
            if (pickConstraint) {
                physics.removeConstraint(pickConstraint);
                pickConstraint = null;
            }                        
        }});

    CubicVR.MainLoop(function(timer, gl) {
        var lus = timer.getLastUpdateSeconds();
		
        if (lus>0.1) lus = 0.2;
        
        if (steer) {
            vehicle.incSteering(steer*lus);
        } else {
			vehicle.setSteering(vehicle.getSteering()-(vehicle.getSteering()*lus*2.0));
        }
        
        if (gas > 0) {
           vehicle.incEngine(lus*300.0); 
        } else if (gas < 0) {
			if (vehicle.getEngineForce()>0) {
				vehicle.setEngineForce(vehicle.getEngineForce()-(vehicle.getEngineForce()*lus*10.0));                           
			}
			vehicle.decEngine(lus*200.0); 
        } else {
			vehicle.setEngineForce(vehicle.getEngineForce()-(vehicle.getEngineForce()*lus*2.0));
        }
        
        if (brake) {
			vehicle.setBrake(brake);
            vehicle.setEngineForce(0);
        } else {
            vehicle.setBrake(0);
        }

        physics.stepSimulation(lus,10);
		
		// render all cars in plane
		for(var i=0 ; i<cars.length ; i++) {
			if(carsInit[i] == false) {
				var car = cars[i];
				scene = level.getLevel();
				scene.bind(car);
				physics.bind(car);
				CubicVR.addResizeable(scene);
				carsInit[i] = true;
			} 
			
			cars[i].evaluate();
		}
		
        scene.render();
        scene.camera.trackTarget(vehicle.getSceneObject().position,lus*5.0,6.0);
        scene.camera.target = vehicle.getSceneObject().position;
        
        var camFloor = 4.0;
        var rayTo = CubicVR.vec3.add(scene.camera.position,[0,-8,0]);
        var result = physics.getRayHit(scene.camera.position,rayTo,true);

        if (result) {
            if (camFloor < result.position[1]+camFloor) {
                camFloor = result.position[1]+camFloor;
            }
        }
        
        if (scene.camera.position[1] < camFloor) {
            scene.camera.position[1] = camFloor;
        }
    });
}
