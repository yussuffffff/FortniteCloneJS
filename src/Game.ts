import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './entities/Player';
import { Terrain } from './entities/Terrain';
import { Sky } from './entities/Sky';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private physicsWorld: CANNON.World;
    private player: Player;
    private terrain: Terrain;
    private sky: Sky;
    private lastTime: number = 0;

    constructor() {
        // Initialize scene
        this.scene = new THREE.Scene();

        // Initialize camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        // Initialize renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        // Initialize physics
        this.physicsWorld = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });

        // Create sky (includes main lighting)
        this.sky = new Sky(this.scene);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Create terrain
        this.terrain = new Terrain(this.scene, this.physicsWorld);

        // Create player
        this.player = new Player(this.scene, this.camera, this.physicsWorld);

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Start game loop
        this.animate();
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update physics
        this.physicsWorld.step(1/60);

        // Update player
        this.player.update();

        // Update sky
        this.sky.update(deltaTime);

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
} 