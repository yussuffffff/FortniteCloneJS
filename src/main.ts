import * as THREE from 'three';
import { World } from './core/World';
import { Player } from './entities/Player';

class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private world: World;
    private player: Player;
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

        // Initialize world
        this.world = new World(this.scene);

        // Create player
        this.player = new Player(this.scene, this.camera, this.world.getPhysicsWorld());

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

        // Update world
        this.world.update(deltaTime);

        // Update player
        this.player.update();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new Game(); 