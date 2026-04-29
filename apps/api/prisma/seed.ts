import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('retrobuzz', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@retrobuzz.io' },
    update: {},
    create: {
      email: 'admin@retrobuzz.io',
      passwordHash,
      displayName: 'Admin RetroBuzz',
    },
  });

  const demo = await prisma.playlist.create({
    data: {
      userId: admin.id,
      name: 'Demo — Hits 90s/2000s',
      sourcePlatform: 'manual',
      trackCount: 5,
      tracks: {
        create: [
          { title: 'Wonderwall', artist: 'Oasis', year: 1995, position: 0 },
          { title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, position: 1 },
          { title: "It's My Life", artist: 'Bon Jovi', year: 2000, position: 2, hasBonus: true },
          { title: 'Believe', artist: 'Cher', year: 1998, position: 3 },
          { title: 'Seven Nation Army', artist: 'The White Stripes', year: 2003, position: 4 },
        ],
      },
    },
  });

  console.log('✅ Seed OK');
  console.log(`   → User : admin@retrobuzz.io / retrobuzz`);
  console.log(`   → Playlist demo : ${demo.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
