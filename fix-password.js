const bcrypt = require('bcryptjs');

async function generateHash() {
    const hash = await bcrypt.hash('admin123', 10);
    console.log('New hash for admin123:', hash);
}

generateHash();
