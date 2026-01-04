const auth = (req, res, next) => {
    if (req.session && req.session.userId) {
        req.user = {
            id: req.session.userId,
            role: req.session.role
        };
        next();
    } else {
        res.status(401).json({ message: 'No session, authorization denied' });
    }
};
module.exports = auth;
