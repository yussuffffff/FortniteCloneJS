import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createNoise2D } from 'simplex-noise';

interface TreeData {
    health: number;
    physicsBody: CANNON.Body;
}

export class World {
    private scene: THREE.Scene;
    private physicsWorld: CANNON.World;
    private terrain!: THREE.Mesh;
    private trees: THREE.Group;
    private treeData: Map<THREE.Object3D, TreeData> = new Map();
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

        // Create gradient closer to Fortnite's style (brighter blue, soft horizon)
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#00A1FF');    // Bright Sky Blue at the top
        gradient.addColorStop(0.6, '#87CEEB');  // Lighter Sky Blue towards middle
        gradient.addColorStop(0.9, '#E0F8FF');  // Very Light Blue/Cyan near horizon
        gradient.addColorStop(1, '#FFFFFF');    // White/Slightly Yellowish at the horizon (optional: use #FFFFAA for slight yellow)

        // Fill the canvas with the gradient
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Create and configure the sky texture
        const skyTexture = new THREE.CanvasTexture(canvas);
        skyTexture.needsUpdate = true; // Ensure texture updates

        // *** DEBUG: Use a simple bright color material instead of the texture *** --> Reverting to original
        const skyMaterial = new THREE.MeshBasicMaterial({
            map: skyTexture, // Use the generated gradient texture
            // color: 0xff0000, // Bright Red - REMOVED FOR DEBUG
            side: THREE.BackSide, // Render on the inside
            fog: false, // Sky shouldn't be affected by fog
            depthWrite: false // Render behind everything else
        });
        // console.log('DEBUG: Using simple RED material for sky sphere.'); // REMOVED FOR DEBUG

        // Create larger sky sphere 
        const skyGeometry = new THREE.SphereGeometry(5000, 32, 15);
        this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
        this.skyMesh.position.set(0, 0, 0); // Ensure it's centered
        this.skyMesh.renderOrder = -1000; // Render first
        
        // --- Add detailed logging before adding to scene --- // REMOVING DEBUG LOGS
        // console.log('DEBUG: skyMesh object created:', {
        //     uuid: this.skyMesh.uuid,
        //     type: this.skyMesh.type,
        //     geometry_type: this.skyMesh.geometry?.type,
        //     material_type: (this.skyMesh.material as THREE.Material)?.type,
        //     material_color: (this.skyMesh.material as THREE.MeshBasicMaterial)?.color?.getHexString(),
        //     position: this.skyMesh.position,
        //     renderOrder: this.skyMesh.renderOrder,
        //     visible: this.skyMesh.visible
        // });
        // 
        // console.log('DEBUG: Attempting to add skyMesh to the scene...');
        this.scene.add(this.skyMesh);
        // console.log('DEBUG: skyMesh *should* be added to the scene.', this.scene.children.includes(this.skyMesh) ? 'Confirmed in children array.' : 'NOT FOUND in children array!');

        // Ensure scene background is null to see the sky sphere
        // console.log('DEBUG: Setting scene.background to null.'); // REMOVING DEBUG LOG
        this.scene.background = null;
        // console.log('DEBUG: scene.background is now:', this.scene.background); // REMOVING DEBUG LOG

        // --- Lighting Adjustments --- 

        // Keep existing sun visualization (adjust position slightly if needed)
        const sunGeometry = new THREE.SphereGeometry(40, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff80 });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.set(200, 300, -400); // Adjusted sun position slightly
        this.scene.add(sun);

        // Keep sun glow
        const sunGlowGeometry = new THREE.SphereGeometry(55, 32, 32);
        const sunGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff80,
            transparent: true,
            opacity: 0.2
        });
        const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
        sunGlow.position.copy(sun.position);
        this.scene.add(sunGlow);

        // Adjust main directional light (sun) - Increase intensity slightly
        this.sunLight = new THREE.DirectionalLight(0xfffaf0, 1.5); // Increased intensity from 1.2 to 1.5
        this.sunLight.position.copy(sun.position);
        this.sunLight.castShadow = true;

        // Keep shadow properties (adjust if shadows look wrong)
        this.sunLight.shadow.mapSize.width = 2048; // Can reduce from 4096 for performance
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 1000; // Reduced far plane slightly
        this.sunLight.shadow.camera.left = -500;
        this.sunLight.shadow.camera.right = 500;
        this.sunLight.shadow.camera.top = 500;
        this.sunLight.shadow.camera.bottom = -500;
        this.sunLight.shadow.bias = -0.001; // Adjusted bias slightly
        // this.sunLight.shadow.normalBias = 0.02; // Keep or adjust normal bias if needed

        this.scene.add(this.sunLight);

        // Adjust Hemisphere Light - More balanced top/bottom light
        const hemiLight = new THREE.HemisphereLight(0xB1E1FF, 0xB97A20, 0.8); // Sky color, Ground color, Intensity increased to 0.8
        this.scene.add(hemiLight);

        // Adjust Ambient Light - Increase intensity for overall brightness
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Increased intensity from 0.4 to 0.6
        this.scene.add(ambientLight);
        
        console.log('Sky and lighting updated.');
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
        // Create tree instances with physics and health tracking
        const treeCount = 50;
        const treeGeometry = new THREE.CylinderGeometry(0.5, 0.8, 8, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2810 });
        const leafGeometry = new THREE.SphereGeometry(2, 8, 8);
        const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x0f5f13 });

        for (let i = 0; i < treeCount; i++) {
            const treeGroup = new THREE.Group();
            
            // Create tree trunk
            const trunk = new THREE.Mesh(treeGeometry, treeMaterial);
            trunk.castShadow = true;
            trunk.position.y = 4;
            trunk.userData.isTreePart = true; // Mark as part of a tree
            treeGroup.add(trunk);

            // Create tree leaves
            const leaves = new THREE.Mesh(leafGeometry, leafMaterial);
            leaves.castShadow = true;
            leaves.position.y = 8;
            leaves.userData.isTreePart = true; // Mark as part of a tree
            treeGroup.add(leaves);

            // Random position
            const x = (Math.random() - 0.5) * 200;
            const z = (Math.random() - 0.5) * 200;
            const y = this.sampleTerrainHeight(x, z);
            treeGroup.position.set(x, y, z);

            // Add tree to scene
            this.trees.add(treeGroup);
            treeGroup.userData.isTree = true;

            // Create physics body for the tree
            const treeShape = new CANNON.Cylinder(0.5, 0.8, 8, 8);
            const treeBody = new CANNON.Body({
                mass: 0,
                shape: treeShape,
                position: new CANNON.Vec3(x, y + 4, z)
            });
            this.physicsWorld.addBody(treeBody);

            // Store tree data
            this.treeData.set(treeGroup, {
                health: 5, // 5 hits to destroy
                physicsBody: treeBody
            });
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

    public update(deltaTime: number): void {
        // Update physics world
        this.physicsWorld.step(1/60, deltaTime, 3);
    }

    public getPhysicsWorld(): CANNON.World {
        return this.physicsWorld;
    }

    public getTreeCount(): number {
        return this.treeData.size;
    }

    public getTreesGroup(): THREE.Group {
        return this.trees;
    }

    public handleTreeHit(treeObject: THREE.Object3D, hitPoint: THREE.Vector3): number {
        console.log('handleTreeHit called with:', {
            treeObject,
            hitPoint,
            hasTreeData: this.treeData.has(treeObject),
            treeDataSize: this.treeData.size,
            treeUserData: treeObject.userData,
            treeChildren: treeObject.children.map(child => ({
                type: child.type,
                userData: child.userData
            }))
        });

        const data = this.treeData.get(treeObject);
        if (!data) {
            console.error('No tree data found for object:', {
                treeObject,
                allTreeData: Array.from(this.treeData.entries()).map(([obj, data]) => ({
                    objectId: obj.uuid,
                    health: data.health
                }))
            });
            return 0;
        }

        // Create hit effect
        this.createHitEffect(hitPoint);

        // Reduce tree health
        data.health--;
        console.log('Tree health reduced to:', {
            health: data.health,
            treeId: treeObject.uuid
        });
        
        // If tree is destroyed
        if (data.health <= 0) {
            console.log('Tree destroyed, cleaning up...', {
                treeId: treeObject.uuid,
                position: treeObject.position
            });
            // Remove tree from scene and physics world
            treeObject.removeFromParent();
            this.physicsWorld.removeBody(data.physicsBody);
            this.treeData.delete(treeObject);

            // Create destruction effect
            this.createDestructionEffect(treeObject.position);
        } else {
            // Shake the tree
            this.shakeTree(treeObject);
        }

        // Return wood amount (10 per hit)
        return 10;
    }

    private createHitEffect(position: THREE.Vector3): void {
        // Create particles for hit effect
        const particleCount = 10;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshBasicMaterial({ color: 0x4a2810 })
            );
            
            particle.position.copy(position);
            particles.add(particle);
            
            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );
            
            // Animate particle
            const animate = () => {
                particle.position.add(velocity);
                velocity.y -= 0.1; // Gravity
                
                particle.scale.multiplyScalar(0.95); // Shrink
                
                if (particle.scale.x < 0.01) {
                    particles.remove(particle);
                    if (particles.children.length === 0) {
                        this.scene.remove(particles);
                    }
                } else {
                    requestAnimationFrame(animate);
                }
            };
            
            requestAnimationFrame(animate);
        }
        
        this.scene.add(particles);
    }

    private createDestructionEffect(position: THREE.Vector3): void {
        // Create larger particles for tree destruction
        const particleCount = 20;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.MeshBasicMaterial({ color: 0x4a2810 })
            );
            
            particle.position.copy(position);
            particles.add(particle);
            
            // Random velocity with more spread
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                Math.random() * 4,
                (Math.random() - 0.5) * 4
            );
            
            // Animate particle
            const animate = () => {
                particle.position.add(velocity);
                velocity.y -= 0.1; // Gravity
                
                particle.scale.multiplyScalar(0.95); // Shrink
                particle.rotateX(0.1);
                particle.rotateY(0.1);
                
                if (particle.scale.x < 0.01) {
                    particles.remove(particle);
                    if (particles.children.length === 0) {
                        this.scene.remove(particles);
                    }
                } else {
                    requestAnimationFrame(animate);
                }
            };
            
            requestAnimationFrame(animate);
        }
        
        this.scene.add(particles);
    }

    private shakeTree(treeObject: THREE.Object3D): void {
        const originalRotation = treeObject.rotation.clone();
        const shakeAmount = 0.1;
        let time = 0;
        
        const animate = () => {
            time += 0.1;
            treeObject.rotation.x = originalRotation.x + Math.sin(time) * shakeAmount;
            treeObject.rotation.z = originalRotation.z + Math.cos(time) * shakeAmount;
            
            if (time > Math.PI * 2) {
                treeObject.rotation.copy(originalRotation);
            } else {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
} 