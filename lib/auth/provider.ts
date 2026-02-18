import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export async function verifyProviderAuth(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return null;
    }

    const verified = await jwtVerify(token, secret);
    const payload = verified.payload as any;

    // التحقق من أن المستخدم مقدم خدمة
    if (payload.role !== 'provider') {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Provider auth verification error:', error);
    return null;
  }
}
