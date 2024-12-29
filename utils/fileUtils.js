const fs = require('fs');
const path = require('path');

const checkFileExists = async (filePath) => {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

module.exports = { checkFileExists }; 