import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const universities = [
  { name: 'DePaul University', slug: 'depaul', city: 'Chicago', state: 'IL', issOfficeUrl: 'https://offices.depaul.edu/global-engagement/student-resources/international-student-scholar-services/Pages/default.aspx' },
  { name: 'University of Illinois Chicago', slug: 'uic', city: 'Chicago', state: 'IL' },
  { name: 'Illinois Institute of Technology', slug: 'iit', city: 'Chicago', state: 'IL' },
  { name: 'Northwestern University', slug: 'northwestern', city: 'Evanston', state: 'IL' },
  { name: 'University of Illinois Urbana-Champaign', slug: 'uiuc', city: 'Champaign', state: 'IL' },
  { name: 'Purdue University', slug: 'purdue', city: 'West Lafayette', state: 'IN' },
  { name: 'Arizona State University', slug: 'asu', city: 'Tempe', state: 'AZ' },
  { name: 'New York University', slug: 'nyu', city: 'New York', state: 'NY' },
  { name: 'Northeastern University', slug: 'northeastern', city: 'Boston', state: 'MA' },
  { name: 'University of Texas at Dallas', slug: 'utd', city: 'Richardson', state: 'TX' },
];

async function main() {
  for (const u of universities) {
    await prisma.university.upsert({ where: { slug: u.slug }, create: u, update: u });
  }
  console.log(`Seeded ${universities.length} universities`);
}

main().finally(() => prisma.$disconnect());
