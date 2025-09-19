const fs = require('fs');
const { createCanvas } = require('canvas');

function createTrayIcon() {
    const canvas = createCanvas(16, 16);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e44332';
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('T', 8, 12);

    return canvas.toBuffer('image/png');
}

fs.writeFileSync('tray-icon.png', createTrayIcon());
console.log('Tray icon created!');