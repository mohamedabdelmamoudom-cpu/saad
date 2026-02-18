import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export async function verifyAdminAuth(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return null;
    }

    const verified = await jwtVerify(token, secret);
    const payload = verified.payload as any;

    // التحقق من أن المستخدم أدمن
    if (payload.role !== 'admin' || payload.is_super_admin !== true) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return null;
  }
}
