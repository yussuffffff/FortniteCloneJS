import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createNoise2D } from 'simplex-noise';

export class Terrain {
    private scene: THREE.Scene;
    private physicsWorld: CANNON.World;
    private terrainMesh!: THREE.Mesh;
    private groundBody!: CANNON.Body;
    private noise2D: (x: number, y: number) => number;

    constructor(scene: THREE.Scene, physicsWorld: CANNON.World) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.noise2D = createNoise2D();
        
        this.createTerrain();
        this.addGroundDetails();
    }

    private createTerrain(): void {
        // Create detailed terrain geometry
        const size = 200;
        const resolution = 128;
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        const vertices = geometry.attributes.position.array;

        // Apply noise to create hills and valleys
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            // Combine multiple noise frequencies for more natural terrain
            const elevation = 
                this.noise2D(x * 0.02, y * 0.02) * 4 + // Large hills
                this.noise2D(x * 0.04, y * 0.04) * 2 + // Medium details
                this.noise2D(x * 0.08, y * 0.08); // Small details
            vertices[i + 2] = elevation;
        }

        // Update geometry
        geometry.computeVertexNormals();
        geometry.attributes.position.needsUpdate = true;

        // Create ground material with textures
        const textureLoader = new THREE.TextureLoader();
        const grassTexture = textureLoader.load('/textures/grass.jpg');
        const grassNormal = textureLoader.load('/textures/grass_normal.jpg');
        
        grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
        grassNormal.wrapS = grassNormal.wrapT = THREE.RepeatWrapping;
        
        grassTexture.repeat.set(50, 50);
        grassNormal.repeat.set(50, 50);

        const material = new THREE.MeshStandardMaterial({
            map: grassTexture,
            normalMap: grassNormal,
            normalScale: new THREE.Vector2(1, 1),
            roughness: 0.8,
            metalness: 0.1
        });

        // Create and add terrain mesh
        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.rotation.x = -Math.PI / 2;
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);

        // Create physics body for terrain
        const groundShape = new CANNON.Heightfield(
            this.createHeightfieldData(resolution + 1, size),
            {
                elementSize: size / resolution
            }
        );

        this.groundBody = new CANNON.Body({ mass: 0 });
        this.groundBody.addShape(groundShape);
        this.groundBody.position.set(-size/2, -2, size/2);
        this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2);
        this.physicsWorld.addBody(this.groundBody);
    }

    private createHeightfieldData(resolution: number, size: number): number[][] {
        const data: number[][] = [];
        const vertices = this.terrainMesh.geometry.attributes.position.array;
        
        for (let i = 0; i < resolution; i++) {
            data[i] = [];
            for (let j = 0; j < resolution; j++) {
                const index = (i * resolution + j) * 3 + 2;
                data[i][j] = vertices[index] || 0;
            }
        }
        
        return data;
    }

    private addGroundDetails(): void {
        // Create instanced rocks
        const rockGeometry = new THREE.IcosahedronGeometry(0.5, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });
        const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 200);
        
        // Create instanced bushes
        const bushGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const bushMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d5a27,
            roughness: 0.8,
            metalness: 0.1
        });
        const bushes = new THREE.InstancedMesh(bushGeometry, bushMaterial, 300);

        // Place rocks and bushes
        const dummy = new THREE.Object3D();
        const raycaster = new THREE.Raycaster();
        const down = new THREE.Vector3(0, -1, 0);

        // Place rocks
        for (let i = 0; i < 200; i++) {
            dummy.position.set(
                Math.random() * 180 - 90,
                10,
                Math.random() * 180 - 90
            );

            // Find ground height
            raycaster.set(dummy.position, down);
            const intersects = raycaster.intersectObject(this.terrainMesh);
            
            if (intersects.length > 0) {
                dummy.position.y = intersects[0].point.y;
                dummy.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                dummy.scale.setScalar(0.3 + Math.random() * 0.7);
                dummy.updateMatrix();
                rocks.setMatrixAt(i, dummy.matrix);
            }
        }

        // Place bushes
        for (let i = 0; i < 300; i++) {
            dummy.position.set(
                Math.random() * 180 - 90,
                10,
                Math.random() * 180 - 90
            );

            raycaster.set(dummy.position, down);
            const intersects = raycaster.intersectObject(this.terrainMesh);
            
            if (intersects.length > 0) {
                dummy.position.y = intersects[0].point.y;
                dummy.rotation.y = Math.random() * Math.PI * 2;
                dummy.scale.setScalar(0.5 + Math.random() * 1);
                dummy.updateMatrix();
                bushes.setMatrixAt(i, dummy.matrix);
            }
        }

        rocks.castShadow = true;
        bushes.castShadow = true;
        this.scene.add(rocks);
        this.scene.add(bushes);
    }
} 