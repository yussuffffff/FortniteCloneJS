import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, AnimationAction, AnimationClip } from 'three';

enum WeaponType {
    PICKAXE = 'pickaxe',
    GUN = 'gun'
}

interface PlayerAnimations {
    idle: AnimationAction;
    walk: AnimationAction;
    run: AnimationAction;
    jump: AnimationAction;
}

export class Player {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private playerBody: CANNON.Body;
    private moveSpeed: number = 15;
    private jumpForce: number = 7;
    private health: number = 100;
    private wood: number = 0;
    private isJumping: boolean = false;
    private moveState = {
        forward: false,
        backward: false,
        left: false,
        right: false
    };
    private physicsWorld: CANNON.World;
    private yawObject: THREE.Object3D;
    private pitchObject: THREE.Object3D;
    private maxVelocity: number = 20;
    private acceleration: number = 0.4;
    private deceleration: number = 0.85;
    private mixer?: AnimationMixer;
    private animations?: PlayerAnimations;
    private currentAnimation?: AnimationAction;
    private currentWeapon: WeaponType = WeaponType.PICKAXE;
    private pickaxeModel: THREE.Group;
    private gunModel: THREE.Group;
    private crosshair: HTMLDivElement;
    private isSwinging: boolean = false;
    private weaponSlots: HTMLDivElement[] = [];

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, physicsWorld: CANNON.World) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = physicsWorld;

        // Create camera rig for rotation
        this.pitchObject = new THREE.Object3D();
        camera.position.set(0, 0, 0);
        this.pitchObject.add(camera);

        this.yawObject = new THREE.Object3D();
        this.yawObject.position.y = 1.7;
        this.yawObject.add(this.pitchObject);

        scene.add(this.yawObject);

        // Create physics body with improved settings
        const shape = new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.3));
        const playerMaterial = new CANNON.Material('player');
        
        // Create contact material between player and ground
        const groundPlayerContact = new CANNON.ContactMaterial(
            this.physicsWorld.defaultMaterial,
            playerMaterial,
            {
                friction: 0.0,
                restitution: 0.0,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3,
                frictionEquationStiffness: 1e8,
                frictionEquationRelaxation: 3
            }
        );
        this.physicsWorld.addContactMaterial(groundPlayerContact);

        this.playerBody = new CANNON.Body({
            mass: 70,
            shape: shape,
            material: playerMaterial,
            fixedRotation: true,
            position: new CANNON.Vec3(0, 3, 0),
            linearDamping: 0.0,
            angularDamping: 0.99
        });

        // Add body to physics world
        this.physicsWorld.addBody(this.playerBody);

        // Create weapon models
        this.pickaxeModel = this.createPickaxe();
        this.gunModel = this.createGun();
        this.camera.add(this.pickaxeModel);
        this.camera.add(this.gunModel);
        this.updateWeaponVisibility();

        // Create crosshair
        this.crosshair = this.createCrosshair();
        document.body.appendChild(this.crosshair);

        // Create weapon slots UI
        this.createWeaponSlotsUI();

        // Initialize controls
        this.setupControls();
    }

    private createCrosshair(): HTMLDivElement {
        const crosshair = document.createElement('div');
        crosshair.style.position = 'fixed';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.width = '16px';
        crosshair.style.height = '16px';
        crosshair.style.pointerEvents = 'none';
        
        // Create crosshair lines
        const createLine = (vertical: boolean) => {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.backgroundColor = 'white';
            if (vertical) {
                line.style.width = '2px';
                line.style.height = '16px';
                line.style.left = '7px';
            } else {
                line.style.width = '16px';
                line.style.height = '2px';
                line.style.top = '7px';
            }
            return line;
        };

        crosshair.appendChild(createLine(true));
        crosshair.appendChild(createLine(false));
        
        return crosshair;
    }

    private createWeaponSlotsUI(): void {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.display = 'flex';
        container.style.gap = '10px';
        container.style.pointerEvents = 'none';

        // Create two weapon slots
        for (let i = 0; i < 2; i++) {
            const slot = document.createElement('div');
            slot.style.width = '80px';
            slot.style.height = '80px';
            slot.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            slot.style.border = '2px solid #666';
            slot.style.borderRadius = '4px';
            slot.style.display = 'flex';
            slot.style.flexDirection = 'column';
            slot.style.alignItems = 'center';
            slot.style.justifyContent = 'space-between';
            slot.style.padding = '5px';

            // Add key number
            const keyNumber = document.createElement('div');
            keyNumber.textContent = (i + 1).toString();
            keyNumber.style.color = 'white';
            keyNumber.style.fontSize = '18px';
            keyNumber.style.fontFamily = 'Arial, sans-serif';
            keyNumber.style.position = 'absolute';
            keyNumber.style.top = '5px';
            keyNumber.style.right = '5px';
            slot.appendChild(keyNumber);

            // Add weapon icon
            const icon = document.createElement('div');
            icon.style.width = '50px';
            icon.style.height = '50px';
            icon.style.backgroundSize = 'contain';
            icon.style.backgroundRepeat = 'no-repeat';
            icon.style.backgroundPosition = 'center';
            icon.style.marginTop = '15px';
            
            // Set weapon icons
            if (i === 0) {
                icon.style.backgroundImage = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"white\" d=\"M14.5 9.5L19 5l-1-1-3.5 3.5-1-1L15 5l-1-1-3.5 3.5-1-1L11 5 10 4 5.5 8.5l1 1L8 8l1 1-1.5 1.5 1 1L10 10l1 1-1.5 1.5 1 1L12 12l1 1-4.5 4.5 1 1L15 13l-1.5-1.5 1-1z\"/></svg>')";
            } else {
                icon.style.backgroundImage = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"white\" d=\"M21 9L17 5V8H10V10H17V13M7 11L3 15L7 19V16H14V14H7V11Z\"/><path fill=\"white\" d=\"M22 6.92L20.59 5.5L17.74 8.72C15.68 6.4 12.83 5 9.61 5C6.72 5 4.07 6.16 2 8L3.42 9.42C5.12 7.93 7.27 7 9.61 7C12.35 7 14.7 8.26 16.38 10.24L13.5 13.5L17.5 17.5L21 14V6.92Z\"/></svg>')";
            }
            
            slot.appendChild(icon);
            container.appendChild(slot);
            this.weaponSlots.push(slot);
        }

        document.body.appendChild(container);
    }

    private createPickaxe(): THREE.Group {
        const pickaxe = new THREE.Group();
        
        // Handle
        const handleGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.4);
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        
        // Head base
        const headBaseGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.15);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x505050 });
        const headBase = new THREE.Mesh(headBaseGeometry, headMaterial);
        headBase.position.y = 0.2;
        
        // Pickaxe points
        const pointGeometry = new THREE.ConeGeometry(0.02, 0.1, 4);
        const pointMaterial = new THREE.MeshStandardMaterial({ color: 0x707070 });
        
        // Front point
        const frontPoint = new THREE.Mesh(pointGeometry, pointMaterial);
        frontPoint.rotation.x = Math.PI / 2;
        frontPoint.position.set(0, 0.2, 0.1);
        
        // Back point
        const backPoint = new THREE.Mesh(pointGeometry, pointMaterial);
        backPoint.rotation.x = -Math.PI / 2;
        backPoint.position.set(0, 0.2, -0.1);
        
        pickaxe.add(handle);
        pickaxe.add(headBase);
        pickaxe.add(frontPoint);
        pickaxe.add(backPoint);
        
        // Position in view
        pickaxe.position.set(0.3, -0.2, -0.4);
        pickaxe.rotation.set(0.2, -0.3, 0);
        
        return pickaxe;
    }

    private createGun(): THREE.Group {
        const gun = new THREE.Group();
        
        // Main body
        const bodyGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.03);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2);
        const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.15;
        
        // Grip
        const gripGeometry = new THREE.BoxGeometry(0.04, 0.12, 0.03);
        const grip = new THREE.Mesh(gripGeometry, bodyMaterial);
        grip.position.set(0, -0.08, 0);
        
        // Magazine
        const magGeometry = new THREE.BoxGeometry(0.03, 0.08, 0.025);
        const magMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const magazine = new THREE.Mesh(magGeometry, magMaterial);
        magazine.position.set(0, -0.06, 0);
        
        // Sight
        const sightGeometry = new THREE.BoxGeometry(0.03, 0.02, 0.02);
        const sight = new THREE.Mesh(sightGeometry, bodyMaterial);
        sight.position.set(0, 0.05, 0);
        
        gun.add(body);
        gun.add(barrel);
        gun.add(grip);
        gun.add(magazine);
        gun.add(sight);
        
        // Position in view
        gun.position.set(0.3, -0.2, -0.4);
        gun.rotation.set(0, 0, 0);
        gun.rotateY(Math.PI / 2);
        gun.visible = false;
        
        return gun;
    }

    private updateWeaponVisibility(): void {
        this.pickaxeModel.visible = this.currentWeapon === WeaponType.PICKAXE;
        this.gunModel.visible = this.currentWeapon === WeaponType.GUN;

        // Update weapon slot highlights
        this.weaponSlots.forEach((slot, index) => {
            if ((index === 0 && this.currentWeapon === WeaponType.PICKAXE) ||
                (index === 1 && this.currentWeapon === WeaponType.GUN)) {
                slot.style.border = '2px solid #fff';
                slot.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            } else {
                slot.style.border = '2px solid #666';
                slot.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            }
        });
    }

    private setupControls(): void {
        // Mouse movement
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                this.yawObject.rotation.y -= event.movementX * 0.002;
                this.pitchObject.rotation.x -= event.movementY * 0.002;
                this.pitchObject.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitchObject.rotation.x));
            }
        });

        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'KeyW': this.moveState.forward = true; break;
                case 'KeyS': this.moveState.backward = true; break;
                case 'KeyA': this.moveState.left = true; break;
                case 'KeyD': this.moveState.right = true; break;
                case 'Space': this.jump(); break;
                case 'Digit1': this.switchWeapon(WeaponType.PICKAXE); break;
                case 'Digit2': this.switchWeapon(WeaponType.GUN); break;
            }
        });

        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW': this.moveState.forward = false; break;
                case 'KeyS': this.moveState.backward = false; break;
                case 'KeyA': this.moveState.left = false; break;
                case 'KeyD': this.moveState.right = false; break;
            }
        });

        // Mouse click for actions
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0 && document.pointerLockElement === document.body) { // Left click
                if (this.currentWeapon === WeaponType.PICKAXE) {
                    this.swingPickaxe();
                } else {
                    this.shoot();
                }
            }
        });

        // Pointer lock
        document.addEventListener('click', () => {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        });
    }

    private swingPickaxe(): void {
        const startRotation = {
            x: this.pickaxeModel.rotation.x,
            y: this.pickaxeModel.rotation.y,
            z: this.pickaxeModel.rotation.z
        };
        const startPosition = {
            x: this.pickaxeModel.position.x,
            y: this.pickaxeModel.position.y,
            z: this.pickaxeModel.position.z
        };
        const swingDuration = 400; // ms
        const startTime = Date.now();

        // Prevent multiple swings
        if (this.isSwinging) return;
        this.isSwinging = true;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / swingDuration);
            
            // Create a centered cross-diagonal pattern
            if (progress < 0.25) {
                // First diagonal: top right to bottom left
                const subProgress = progress * 4;
                this.pickaxeModel.rotation.x = startRotation.x + (subProgress * Math.PI / 4);
                this.pickaxeModel.rotation.z = startRotation.z - (subProgress * Math.PI / 4);
            } else if (progress < 0.5) {
                // Return to center
                const subProgress = (progress - 0.25) * 4;
                this.pickaxeModel.rotation.x = startRotation.x + Math.PI / 4 - (subProgress * Math.PI / 4);
                this.pickaxeModel.rotation.z = startRotation.z - Math.PI / 4 + (subProgress * Math.PI / 4);
            } else if (progress < 0.75) {
                // Second diagonal: top left to bottom right
                const subProgress = (progress - 0.5) * 4;
                this.pickaxeModel.rotation.x = startRotation.x - (subProgress * Math.PI / 4);
                this.pickaxeModel.rotation.z = startRotation.z - (subProgress * Math.PI / 4);
            } else {
                // Return to starting position
                const subProgress = (progress - 0.75) * 4;
                this.pickaxeModel.rotation.x = startRotation.x - Math.PI / 4 + (subProgress * Math.PI / 4);
                this.pickaxeModel.rotation.z = startRotation.z - Math.PI / 4 + (subProgress * Math.PI / 4);
            }
            
            // Add forward thrust during the swing
            this.pickaxeModel.position.z = startPosition.z - Math.sin(progress * Math.PI) * 0.2;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Reset position and rotation
                this.pickaxeModel.position.x = startPosition.x;
                this.pickaxeModel.position.y = startPosition.y;
                this.pickaxeModel.position.z = startPosition.z;
                this.pickaxeModel.rotation.x = startRotation.x;
                this.pickaxeModel.rotation.y = startRotation.y;
                this.pickaxeModel.rotation.z = startRotation.z;
                this.isSwinging = false;
            }
        };

        animate();
    }

    private shoot(): void {
        // Create bullet
        const bulletGeometry = new THREE.SphereGeometry(0.02);
        const bulletMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Create bullet trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.5
        });
        
        const trailPoints = [];
        const trailLine = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(trailLine);
        
        // Set bullet position and direction
        const bulletDirection = new THREE.Vector3();
        this.camera.getWorldDirection(bulletDirection);
        const startPosition = this.camera.getWorldPosition(new THREE.Vector3());
        bullet.position.copy(startPosition);
        bullet.position.add(bulletDirection.multiplyScalar(0.5));

        this.scene.add(bullet);

        // Create bullet physics
        const bulletShape = new CANNON.Sphere(0.02);
        const bulletBody = new CANNON.Body({
            mass: 0.1,
            shape: bulletShape,
            position: new CANNON.Vec3(bullet.position.x, bullet.position.y, bullet.position.z),
            velocity: new CANNON.Vec3(
                bulletDirection.x * 50,
                bulletDirection.y * 50,
                bulletDirection.z * 50
            )
        });

        this.physicsWorld.addBody(bulletBody);

        // Flash effect
        const flash = () => {
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
            setTimeout(() => {
                this.crosshair.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 50);
        };
        flash();

        // Gun recoil animation
        const recoil = () => {
            this.gunModel.position.z += 0.1;
            this.gunModel.rotation.x += 0.05;
            
            const startPos = this.gunModel.position.z;
            const startRot = this.gunModel.rotation.x;
            const duration = 150;
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / duration);
                const ease = 1 - Math.pow(1 - progress, 3);
                
                this.gunModel.position.z = startPos - (0.1 * ease);
                this.gunModel.rotation.x = startRot - (0.05 * ease);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };
            animate();
        };
        recoil();

        // Create impact particles
        const createImpactEffect = (position: THREE.Vector3) => {
            const particleCount = 15;
            const particles: THREE.Mesh[] = [];
            
            for (let i = 0; i < particleCount; i++) {
                const particleGeometry = new THREE.SphereGeometry(0.01);
                const particleMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffff00,
                    transparent: true,
                    opacity: 0.8
                });
                const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.position.copy(position);
                
                // Random velocity for each particle
                const velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 2,
                    (Math.random() - 0.5) * 2
                );
                
                particles.push(particle);
                this.scene.add(particle);
                
                // Animate particle
                const startTime = Date.now();
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    if (elapsed > 500) {
                        this.scene.remove(particle);
                        return;
                    }
                    
                    const progress = elapsed / 500;
                    particle.position.add(velocity.clone().multiplyScalar(0.01));
                    velocity.y -= 0.01; // Gravity
                    particle.material.opacity = 0.8 * (1 - progress);
                    
                    requestAnimationFrame(animate);
                };
                animate();
            }
        };

        // Update bullet and trail
        const maxPoints = 50;
        const trailPositions: number[] = [];
        let lastTrailUpdate = Date.now();
        
        const updateBullet = () => {
            if (!bullet.parent) return; // Stop if bullet is removed
            
            // Update bullet position from physics
            bullet.position.copy(bulletBody.position as any);
            
            // Update trail
            const now = Date.now();
            if (now - lastTrailUpdate > 16) { // Update trail every 16ms (60fps)
                trailPositions.push(
                    bullet.position.x,
                    bullet.position.y,
                    bullet.position.z
                );
                
                // Limit trail length
                if (trailPositions.length > maxPoints * 3) {
                    trailPositions.splice(0, 3);
                }
                
                // Update trail geometry
                trailGeometry.setAttribute(
                    'position',
                    new THREE.Float32BufferAttribute(trailPositions, 3)
                );
                
                lastTrailUpdate = now;
            }
            
            // Check for collisions
            const raycaster = new THREE.Raycaster(
                bullet.position.clone(),
                bulletBody.velocity.clone().normalize() as any,
                0,
                0.1
            );
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            
            if (intersects.length > 0) {
                // Create impact effect
                createImpactEffect(intersects[0].point);
                
                // Remove bullet and trail
                this.scene.remove(bullet);
                this.scene.remove(trailLine);
                this.physicsWorld.removeBody(bulletBody);
                return;
            }
            
            requestAnimationFrame(updateBullet);
        };
        updateBullet();

        // Remove bullet after 2 seconds if no collision
        setTimeout(() => {
            if (bullet.parent) {
                this.scene.remove(bullet);
                this.scene.remove(trailLine);
                this.physicsWorld.removeBody(bulletBody);
            }
        }, 2000);
    }

    private switchWeapon(weapon: WeaponType): void {
        this.currentWeapon = weapon;
        this.updateWeaponVisibility();
    }

    private applyMovement(): void {
        if (!this.playerBody) return;

        // Get current velocity
        const velocity = this.playerBody.velocity;
        
        // Ground check
        const rayStart = this.playerBody.position.clone();
        const rayEnd = rayStart.clone();
        rayEnd.y -= 1.2;
        
        const ray = new CANNON.Ray(rayStart, rayEnd);
        ray.skipBackfaces = true;
        
        const result = new CANNON.RaycastResult();
        ray.intersectWorld(this.physicsWorld, { result });
        
        const onGround = result.hasHit;
        
        if (onGround) {
            this.isJumping = false;
        }

        // Calculate movement direction based on camera rotation
        const moveDirection = new THREE.Vector3();
        
        if (this.moveState.forward) moveDirection.z -= 1;
        if (this.moveState.backward) moveDirection.z += 1;
        if (this.moveState.left) moveDirection.x -= 1;
        if (this.moveState.right) moveDirection.x += 1;
        
        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize();
            
            // Apply camera rotation to movement direction
            const rotation = new THREE.Euler(0, this.yawObject.rotation.y, 0, 'XYZ');
            moveDirection.applyEuler(rotation);
            
            // Apply direct velocity control for more responsive movement
            const targetVelocity = new CANNON.Vec3(
                moveDirection.x * this.moveSpeed,
                velocity.y,
                moveDirection.z * this.moveSpeed
            );
            
            // Faster acceleration for more responsive movement
            const acceleration = onGround ? 0.5 : 0.1;
            velocity.x += (targetVelocity.x - velocity.x) * acceleration;
            velocity.z += (targetVelocity.z - velocity.z) * acceleration;
        } else if (onGround) {
            // Apply manual friction when not moving
            velocity.x *= 0.9;
            velocity.z *= 0.9;
        }
        
        // Apply velocity limits for horizontal movement
        const horizontalVel = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        if (horizontalVel > this.maxVelocity) {
            const scale = this.maxVelocity / horizontalVel;
            velocity.x *= scale;
            velocity.z *= scale;
        }
        
        // Update camera position
        this.yawObject.position.copy(this.playerBody.position);
        this.yawObject.position.y += 1.7; // Add eye height
    }

    private jump(): void {
        // Only allow jumping when on or near ground
        const rayStart = this.playerBody.position.clone();
        const rayEnd = rayStart.clone();
        rayEnd.y -= 1.2;
        
        const ray = new CANNON.Ray(rayStart, rayEnd);
        ray.skipBackfaces = true;
        
        const result = new CANNON.RaycastResult();
        ray.intersectWorld(this.physicsWorld, { result });
        
        if (result.hasHit && !this.isJumping) {
            this.isJumping = true;
            this.playerBody.velocity.y = this.jumpForce;
        }
    }

    public update(): void {
        // Apply movement based on current move state
        this.applyMovement();

        // Update camera rig position to match physics body
        this.yawObject.position.copy(this.playerBody.position as any);
        this.yawObject.position.y += 1.7; // Keep camera at eye level
    }

    public getPosition(): THREE.Vector3 {
        return new THREE.Vector3(
            this.playerBody.position.x,
            this.playerBody.position.y,
            this.playerBody.position.z
        );
    }

    public getHealth(): number {
        return this.health;
    }

    public getWood(): number {
        return this.wood;
    }

    public damage(amount: number): void {
        this.health = Math.max(0, this.health - amount);
    }

    public heal(amount: number): void {
        this.health = Math.min(100, this.health + amount);
    }

    public addWood(amount: number): void {
        this.wood += amount;
    }
} 