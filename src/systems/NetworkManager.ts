import { io, Socket } from 'socket.io-client';

interface PlayerState {
    id: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    health: number;
}

export class NetworkManager {
    private socket: Socket;
    private players: Map<string, PlayerState>;
    private localPlayerId: string = '';

    constructor() {
        this.players = new Map();
        
        // Connect to game server
        this.socket = io('http://localhost:3000');
        
        // Set up event handlers
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Handle connection
        this.socket.on('connect', () => {
            console.log('Connected to server');
            const id = this.socket.id;
            if (id) {
                this.localPlayerId = id;
            }
        });

        // Handle player join
        this.socket.on('playerJoin', (player: PlayerState) => {
            if (player.id !== this.localPlayerId) {
                this.players.set(player.id, player);
                this.updatePlayerCount();
            }
        });

        // Handle player leave
        this.socket.on('playerLeave', (playerId: string) => {
            this.players.delete(playerId);
            this.updatePlayerCount();
        });

        // Handle player updates
        this.socket.on('playerUpdate', (player: PlayerState) => {
            if (player.id !== this.localPlayerId) {
                this.players.set(player.id, player);
            }
        });

        // Handle disconnection
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.players.clear();
            this.updatePlayerCount();
        });
    }

    public update(): void {
        // Send local player state to server
        if (this.localPlayerId) {
            this.socket.emit('playerUpdate', {
                id: this.localPlayerId,
                position: { x: 0, y: 0, z: 0 }, // Replace with actual player position
                rotation: { x: 0, y: 0, z: 0 }, // Replace with actual player rotation
                health: 100 // Replace with actual player health
            });
        }
    }

    private updatePlayerCount(): void {
        const playerCount = document.getElementById('player-count');
        if (playerCount) {
            playerCount.textContent = `Players: ${this.players.size + 1}`; // +1 for local player
        }
    }

    public getPlayers(): Map<string, PlayerState> {
        return this.players;
    }

    public getLocalPlayerId(): string {
        return this.localPlayerId;
    }
} 