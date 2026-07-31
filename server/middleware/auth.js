import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (_err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}
