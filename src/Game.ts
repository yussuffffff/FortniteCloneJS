import * as THREE from 'three';
import { World } from './core/World';
import { Player } from './entities/Player';
import { InputManager } from './systems/InputManager';
import { NetworkManager } from './systems/NetworkManager';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private world!: World;  // Using definite assignment assertion
    private player!: Player;  // Using definite assignment assertion
    private inputManager!: InputManager;  // Using definite assignment assertion
    private networkManager!: NetworkManager;  // Using definite assignment assertion
    private lastTime: number = 0;

    constructor() {
        console.log('Game constructor - Starting initialization');
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background
        console.log('Scene created');
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.camera.position.set(0, 2, 5); // Set initial camera position
        console.log('Camera created and positioned');

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false // Ensure we have a solid background
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        console.log('Renderer created and configured');

        try {
            console.log('Starting world initialization...');
            // Create world and ensure it's fully initialized
            this.world = new World(this.scene);
            
            // *** DEBUG: Force solid background color to test rendering ***
            // this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue - REMOVED FOR DEBUG
            // console.log('Game.ts: Overriding scene background to solid blue for testing.'); - REMOVED FOR DEBUG
            
            // Debug log the world instance immediately after creation
            console.log('World instance created:', {
                worldInstance: this.world,
                hasPhysicsWorld: this.world?.getPhysicsWorld?.(),
                worldProperties: Object.getOwnPropertyNames(this.world),
                worldPrototype: Object.getOwnPropertyNames(Object.getPrototypeOf(this.world))
            });
            
            // Verify world instance
            if (!this.world) {
                throw new Error('World instance is null after creation');
            }
            
            if (!this.world.getPhysicsWorld) {
                throw new Error('World instance missing getPhysicsWorld method');
            }

            const physicsWorld = this.world.getPhysicsWorld();
            if (!physicsWorld) {
                throw new Error('getPhysicsWorld() returned null');
            }
            
            console.log('World verified successfully:', {
                worldInstance: !!this.world,
                hasPhysicsWorld: !!physicsWorld,
                methods: Object.keys(this.world)
            });

            // Create player with direct reference to world
            console.log('Creating player with world instance...', {
                scene: !!this.scene,
                camera: !!this.camera,
                physicsWorld: !!physicsWorld,
                world: !!this.world
            });
            
            this.player = new Player(
                this.scene, 
                this.camera, 
                physicsWorld,
                this.world
            );
            console.log('Player created successfully');

            // Create input manager
            this.inputManager = new InputManager();
            console.log('Input manager created');

            // Create network manager
            this.networkManager = new NetworkManager();
            console.log('Network manager created');

            // Handle window resize
            window.addEventListener('resize', this.onWindowResize.bind(this), false);
            console.log('Window resize handler attached');

            // Start game loop
            console.log('Starting game loop...');
            this.animate();
        } catch (error: any) {
            console.error('Error initializing game:', error);
            // Display error message to user
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '50%';
            errorDiv.style.left = '50%';
            errorDiv.style.transform = 'translate(-50%, -50%)';
            errorDiv.style.color = 'white';
            errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            errorDiv.style.padding = '20px';
            errorDiv.style.borderRadius = '5px';
            errorDiv.style.fontFamily = 'Arial, sans-serif';
            errorDiv.style.zIndex = '9999';
            errorDiv.textContent = `Error loading game: ${error.message}. Please check console for details.`;
            document.body.appendChild(errorDiv);
        }
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private animate(time: number = 0): void {
        requestAnimationFrame((t) => this.animate(t));

        try {
            // Convert time to seconds and calculate delta
            const deltaTime = (time - this.lastTime) / 1000;
            this.lastTime = time;

            if (!this.world) {
                throw new Error('World instance not available during animation');
            }

            // Update physics and game state
            this.world.update(deltaTime);

            if (!this.player) {
                throw new Error('Player instance not available during animation');
            }

            // Update player
            this.player.update();

            // Render scene
            this.renderer.render(this.scene, this.camera);
        } catch (error) {
            console.error('Error in game loop:', error);
        }
    }
} 