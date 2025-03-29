import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createNoise2D } from 'simplex-noise';

export class World {
    private scene: THREE.Scene;
    private physicsWorld: CANNON.World;
    private terrain!: THREE.Mesh;
    private trees: THREE.Group;
    private noise2D: (x: number, y: number) => number;
    private skyMesh!: THREE.Mesh;
    private sunLight!: THREE.DirectionalLight;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.trees = new THREE.Group();
        this.noise2D = createNoise2D();
        
        // Initialize physics with improved settings
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -9.82, 0);  // Normal gravity
        this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
        (this.physicsWorld.solver as any).iterations = 20;  // Increased iterations for better stability
        this.physicsWorld.allowSleep = false;
        
        // Set up ground material only - player material will be set up in Player class
        const groundMaterial = new CANNON.Material('ground');
        this.physicsWorld.defaultMaterial = groundMaterial;

        // Create sky and lighting
        this.createSky();
        
        // Create terrain
        this.createTerrain();
        
        // Add some trees
        this.createTrees();

        // Add ground clutter
        this.createGroundClutter();
    }

    private createSky(): void {
        // Create a canvas for the sky texture with larger dimensions for better quality
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 2048;
        const context = canvas.getContext('2d');

        if (!context) {
            console.error('Failed to get 2D context for sky canvas');
            return;
        }

        // Create gradient with smoother color transitions
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#4B91E2');    // Top - bright blue
        gradient.addColorStop(0.4, '#87CEEB');  // Upper middle - sky blue
        gradient.addColorStop(0.7, '#B7E1F3');  // Lower middle - light blue
        gradient.addColorStop(0.9, '#E0F2F7');  // Near horizon - very light blue
        gradient.addColorStop(1, '#FFFFFF');    // Horizon - white

        // Fill the canvas with the gradient
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Debug: Log canvas data to verify gradient
        console.log('Sky canvas created with dimensions:', canvas.width, 'x', canvas.height);

        // Create and configure the sky texture
        const skyTexture = new THREE.CanvasTexture(canvas);
        skyTexture.wrapS = THREE.ClampToEdgeWrapping;
        skyTexture.wrapT = THREE.ClampToEdgeWrapping;
        skyTexture.needsUpdate = true;

        // Create sky material with debugging color
        const skyMaterial = new THREE.MeshBasicMaterial({
            map: skyTexture,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false,
            color: 0xFFFFFF,  // White base color to ensure texture visibility
            transparent: false
        });

        // Create larger sky sphere to ensure camera is always inside
        const skyGeometry = new THREE.SphereGeometry(5000, 60, 40);
        this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
        
        // Reset rotation and position
        this.skyMesh.rotation.set(0, 0, 0);
        this.skyMesh.position.set(0, 0, 0);
        
        // Ensure sky renders first
        this.skyMesh.renderOrder = -1000;
        
        // Add to scene
        this.scene.add(this.skyMesh);

        // Clear scene background
        this.scene.background = null;

        // Debug: Log sky mesh creation
        console.log('Sky mesh created and added to scene', {
            geometry: skyGeometry.parameters,
            material: skyMaterial,
            position: this.skyMesh.position,
            renderOrder: this.skyMesh.renderOrder
        });

        // Create sun with glow effect
        const sunGeometry = new THREE.SphereGeometry(40, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff80,
            transparent: true,
            opacity: 0.8
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.set(200, 400, -300);
        this.scene.add(sun);

        // Add sun glow
        const sunGlowGeometry = new THREE.SphereGeometry(55, 32, 32);
        const sunGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff80,
            transparent: true,
            opacity: 0.2
        });
        const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
        sunGlow.position.copy(sun.position);
        this.scene.add(sunGlow);

        // Add main directional light (sun)
        this.sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
        this.sunLight.position.copy(sun.position);
        this.sunLight.castShadow = true;

        // Configure shadow properties
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 1500;
        this.sunLight.shadow.camera.left = -500;
        this.sunLight.shadow.camera.right = 500;
        this.sunLight.shadow.camera.top = 500;
        this.sunLight.shadow.camera.bottom = -500;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.normalBias = 0.02;

        this.scene.add(this.sunLight);

        // Add ambient lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
        this.scene.add(hemiLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
    }

    private createTerrain(): void {
        // Create terrain geometry
        const size = 1000;
        const resolution = 128;
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        const vertices = geometry.attributes.position.array;

        // Apply very gentle noise for minimal terrain variation
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            
            // Add very subtle elevation changes
            const elevation = this.noise2D(x * 0.002, y * 0.002) * 0.5;
            vertices[i + 2] = elevation;
        }

        // Update geometry
        geometry.computeVertexNormals();
        geometry.attributes.position.needsUpdate = true;

        // Create ground material
        const material = new THREE.MeshStandardMaterial({
            color: 0x3a8c3a,  // Simple grass green color
            roughness: 0.8,
            metalness: 0.2
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.rotation.x = -Math.PI / 2;
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        // Create physics body for terrain with the ground material
        const groundShape = new CANNON.Heightfield(
            this.createHeightfieldData(resolution + 1, size),
            { 
                elementSize: size / resolution,
                minValue: -1,
                maxValue: 1
            }
        );

        const groundBody = new CANNON.Body({ 
            mass: 0,
            material: this.physicsWorld.defaultMaterial
        });
        groundBody.addShape(groundShape);
        groundBody.position.set(-size/2, -0.1, size/2);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2);
        this.physicsWorld.addBody(groundBody);
    }

    private sampleTerrainHeight(x: number, z: number): number {
        // Convert world coordinates to noise coordinates
        const noiseX = x * 0.005;
        const noiseZ = z * 0.005;
        
        return this.noise2D(noiseX, noiseZ) * 2 +
               this.noise2D(noiseX * 2, noiseZ * 2) * 1 +
               this.noise2D(noiseX * 4, noiseZ * 4) * 0.5;
    }

    private createHeightfieldData(resolution: number, size: number): number[][] {
        const data: number[][] = [];
        const vertices = this.terrain.geometry.attributes.position.array;
        
        for (let i = 0; i < resolution; i++) {
            data[i] = [];
            for (let j = 0; j < resolution; j++) {
                const index = (i * resolution + j) * 3 + 2;
                data[i][j] = vertices[index] || 0;
            }
        }
        
        return data;
    }

    private createTrees(): void {
        // Create tree geometries with better detail
        const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.5, 4, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.8,
            metalness: 0.2
        });

        // Create canopy using multiple spheres for a fuller look
        const canopyGeometry = new THREE.SphereGeometry(1.5, 12, 12);
        const canopyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d5a27,  // Darker green
            roughness: 0.8,
            metalness: 0.1
        });

        // Create small branch geometry
        const branchGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 5);

        // Create more trees with better distribution
        const numTrees = 300;  // Increased from 100 to 300
        const minRadius = 50;   // Minimum distance from center
        const maxRadius = 450;  // Maximum distance from center
        const gridSize = Math.ceil(Math.sqrt(numTrees));
        
        for (let i = 0; i < numTrees; i++) {
            const treeGroup = new THREE.Group();
            treeGroup.userData.isTree = true;
            
            // Create trunk with slight random variation
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            trunk.position.y = 2;
            trunk.rotation.y = Math.random() * Math.PI;
            treeGroup.add(trunk);

            // Create main canopy spheres
            const canopyGroup = new THREE.Group();
            canopyGroup.position.y = 5;

            // Add multiple spheres for fuller canopy
            const numCanopySpheres = Math.floor(Math.random() * 3) + 4; // 4-6 spheres
            for (let j = 0; j < numCanopySpheres; j++) {
                const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
                canopy.castShadow = true;
                canopy.receiveShadow = true;
                
                // Position spheres with more variation
                canopy.position.set(
                    (Math.random() - 0.5) * 1.2,
                    (Math.random() - 0.5) * 1.0,
                    (Math.random() - 0.5) * 1.2
                );
                
                // Random scaling for variety
                const scale = 0.7 + Math.random() * 0.6;
                canopy.scale.set(scale, scale * 0.9, scale);
                
                canopyGroup.add(canopy);
            }
            
            // Add small branches
            const numBranches = Math.floor(Math.random() * 3) + 3; // 3-5 branches
            for (let k = 0; k < numBranches; k++) {
                const branch = new THREE.Mesh(branchGeometry, trunkMaterial);
                branch.castShadow = true;
                branch.position.y = 2.5 + k * 0.6;
                branch.rotation.z = (Math.random() - 0.5) * Math.PI * 0.6;
                branch.rotation.y = k * (Math.PI * 2 / numBranches);
                branch.position.x = Math.cos(k * (Math.PI * 2 / numBranches)) * 0.8;
                branch.position.z = Math.sin(k * (Math.PI * 2 / numBranches)) * 0.8;
                treeGroup.add(branch);
            }

            treeGroup.add(canopyGroup);
            
            // Position trees in a more natural pattern
            let radius, angle;
            if (i < numTrees * 0.7) {  // 70% of trees in clusters
                // Create clusters of trees
                const clusterCenter = Math.floor(i / 5);  // 5 trees per cluster
                const baseRadius = minRadius + (maxRadius - minRadius) * (Math.random() * 0.8 + 0.2);
                const baseAngle = (clusterCenter / (numTrees * 0.14)) * Math.PI * 2;
                
                radius = baseRadius + (Math.random() - 0.5) * 40;  // Spread within cluster
                angle = baseAngle + (Math.random() - 0.5) * 0.5;   // Angular spread within cluster
            } else {
                // Remaining trees randomly distributed
                radius = minRadius + Math.random() * (maxRadius - minRadius);
                angle = Math.random() * Math.PI * 2;
            }
            
            treeGroup.position.x = Math.cos(angle) * radius;
            treeGroup.position.z = Math.sin(angle) * radius;
            treeGroup.rotation.y = Math.random() * Math.PI * 2;
            
            // Vary tree sizes more
            const treeScale = 0.6 + Math.random() * 0.8;  // More size variation
            treeGroup.scale.set(treeScale, treeScale * (0.9 + Math.random() * 0.2), treeScale);
            
            // Add physics body for the tree
            const treeShape = new CANNON.Cylinder(0.5 * treeScale, 0.5 * treeScale, 4 * treeScale);
            const treeBody = new CANNON.Body({
                mass: 0,
                shape: treeShape,
                position: new CANNON.Vec3(treeGroup.position.x, 2 * treeScale, treeGroup.position.z)
            });
            this.physicsWorld.addBody(treeBody);
            
            this.trees.add(treeGroup);
        }
        
        this.scene.add(this.trees);
    }

    private createGroundClutter(): void {
        // Create rock geometry with low-poly style
        const rockGeometry = new THREE.DodecahedronGeometry(0.8, 2);  // Increased detail level
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,  // Slightly darker gray
            roughness: 1.0,
            metalness: 0.1,
            flatShading: true,  // Keep angular look
            shadowSide: THREE.FrontSide  // Optimize shadow rendering
        });
        const rockInstances = 800;  // Increased for better coverage
        const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockInstances);
        rocks.castShadow = true;
        rocks.receiveShadow = true;

        // Create bush geometry with improved detail
        const bushGeometry = new THREE.SphereGeometry(0.6, 8, 6);  // More segments for better shape
        const bushMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d8a27,  // Keep vibrant green
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true,
            shadowSide: THREE.FrontSide  // Optimize shadow rendering
        });
        const bushInstances = 1200;  // Increased for denser vegetation
        const bushes = new THREE.InstancedMesh(bushGeometry, bushMaterial, bushInstances);
        bushes.castShadow = true;
        bushes.receiveShadow = true;

        // Matrix and temp objects for positioning
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();

        // Place rocks in natural clusters
        for (let i = 0; i < rockInstances; i++) {
            const baseX = Math.random() * 800 - 400;
            const baseZ = Math.random() * 800 - 400;
            // Create tighter clusters
            const x = baseX + (Math.random() * 12 - 6);
            const z = baseZ + (Math.random() * 12 - 6);
            const y = this.sampleTerrainHeight(x, z);

            position.set(x, y, z);
            quaternion.setFromEuler(new THREE.Euler(
                Math.random() * Math.PI * 0.4,  // More rotation variation
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 0.4
            ));
            
            // More varied rock sizes
            const baseScale = 0.4 + Math.random() * 1.8;  // Wider size range
            scale.set(
                baseScale * (0.8 + Math.random() * 0.4),
                baseScale * (0.6 + Math.random() * 0.4),
                baseScale * (0.8 + Math.random() * 0.4)
            );

            matrix.compose(position, quaternion, scale);
            rocks.setMatrixAt(i, matrix);

            // Add physics only for larger rocks, with optimized threshold
            if (baseScale > 1.4) {  // Higher threshold for physics bodies
                const rockShape = new CANNON.Box(new CANNON.Vec3(
                    scale.x * 0.4,  // Slightly smaller collision boxes
                    scale.y * 0.4,
                    scale.z * 0.4
                ));
                const rockBody = new CANNON.Body({
                    mass: 0,
                    material: this.physicsWorld.defaultMaterial,
                    shape: rockShape
                });
                rockBody.position.copy(position as any);
                rockBody.quaternion.copy(quaternion as any);
                this.physicsWorld.addBody(rockBody);
            }
        }

        // Place bushes in natural clusters with varied density
        for (let i = 0; i < bushInstances; i++) {
            const baseX = Math.random() * 800 - 400;
            const baseZ = Math.random() * 800 - 400;
            
            // Create varied cluster sizes
            const clusterSize = Math.random() < 0.3 ? 25 : 15;  // 30% chance of larger clusters
            const x = baseX + (Math.random() * clusterSize - clusterSize/2);
            const z = baseZ + (Math.random() * clusterSize - clusterSize/2);
            const y = this.sampleTerrainHeight(x, z);

            position.set(x, y, z);
            quaternion.setFromEuler(new THREE.Euler(
                Math.random() * Math.PI * 0.2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 0.2
            ));

            // Varied bush sizes within clusters
            const baseScale = 0.8 + Math.random() * 0.6;
            scale.set(
                baseScale * (0.9 + Math.random() * 0.2),
                baseScale * (1.0 + Math.random() * 0.3),
                baseScale * (0.9 + Math.random() * 0.2)
            );

            matrix.compose(position, quaternion, scale);
            bushes.setMatrixAt(i, matrix);
        }

        // Update the instance matrices
        rocks.instanceMatrix.needsUpdate = true;
        bushes.instanceMatrix.needsUpdate = true;

        // Add to scene
        this.scene.add(rocks);
        this.scene.add(bushes);
    }

    public update(deltaTime?: number): void {
        // Update physics with smaller, fixed timestep
        const fixedTimeStep = 1/60;
        const maxSubSteps = 3;
        this.physicsWorld.step(fixedTimeStep, deltaTime || 1/60, maxSubSteps);
    }

    public getPhysicsWorld(): CANNON.World {
        return this.physicsWorld;
    }
} 