export class InputManager {
    private keys: { [key: string]: boolean } = {};
    private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
    private mouseButtons: { [button: number]: boolean } = {};
    private mouseSensitivity: number = 0.002;

    constructor() {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Keyboard events
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            this.keys[e.code] = true;
        });

        document.addEventListener('keyup', (e: KeyboardEvent) => {
            this.keys[e.code] = false;
        });

        // Mouse events
        document.addEventListener('mousemove', (e: MouseEvent) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });

        document.addEventListener('mousedown', (e: MouseEvent) => {
            this.mouseButtons[e.button] = true;
        });

        document.addEventListener('mouseup', (e: MouseEvent) => {
            this.mouseButtons[e.button] = false;
        });

        // Prevent context menu on right click
        document.addEventListener('contextmenu', (e: Event) => {
            e.preventDefault();
        });
    }

    public isKeyPressed(keyCode: string): boolean {
        return this.keys[keyCode] || false;
    }

    public isMouseButtonPressed(button: number): boolean {
        return this.mouseButtons[button] || false;
    }

    public getMousePosition(): { x: number; y: number } {
        return { ...this.mousePosition };
    }

    public getMouseSensitivity(): number {
        return this.mouseSensitivity;
    }

    public setMouseSensitivity(sensitivity: number): void {
        this.mouseSensitivity = sensitivity;
    }
} 