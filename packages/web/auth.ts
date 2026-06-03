import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rate-limiter'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth] Missing credentials')
          return null
        }

        const ip = request?.headers?.get('x-forwarded-for') || 'unknown'
        if (!rateLimit(ip, 5, 60 * 1000)) {
          console.log('[Auth] Rate limited for IP:', ip)
          throw new Error('Too many login attempts, please try again later')
        }

        const email = (credentials.email as string).trim().toLowerCase()
        console.log('[Auth] Login attempt:', { email })

        const user = await prisma.user.findUnique({
          where: { email }
        })

        if (!user) {
          console.log('[Auth] User not found:', email)
          return null
        }

        const account = await prisma.account.findFirst({
          where: {
            userId: user.id,
            provider: 'credentials'
          }
        })

        if (!account || !account.password) {
          console.log('[Auth] No credentials account for user:', email)
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          account.password
        )

        if (!isValid) {
          console.log('[Auth] Invalid password for user:', email)
          return null
        }

        console.log('[Auth] Login successful:', email)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    }
  }
})
