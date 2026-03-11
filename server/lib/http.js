export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export const sendError = (res, status, message) => res.status(status).json({ ok: false, error: message })
