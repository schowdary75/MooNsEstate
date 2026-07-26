const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    let token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ message: "Authentication failed , Token missing" });
    }
    if (token.startsWith('Bearer ')) {
        token = token.slice(7);
    } else if (token.startsWith('Bearer')) {
        token = token.slice(6);
    }
    try {
        const decode = jwt.verify(token, 'secret_key');
        req.user = decode;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Authentication failed. Invalid token.' });
    }
}

module.exports = auth