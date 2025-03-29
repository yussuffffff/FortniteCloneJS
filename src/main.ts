import { Game } from './Game';

// Start the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting game initialization...');
    try {
        const game = new Game();
        console.log('Game initialized successfully');
    } catch (error: any) {
        console.error('Failed to initialize game:', error);
        // Display error to user
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
        errorDiv.textContent = `Failed to initialize game: ${error.message}`;
        document.body.appendChild(errorDiv);
    }
}); 