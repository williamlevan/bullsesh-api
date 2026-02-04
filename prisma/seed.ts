import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create test user (super admin for creating events)
  const testUser = await prisma.user.upsert({
    where: { email: 'admin@bullsesh.com' },
    update: {},
    create: {
      email: 'admin@bullsesh.com',
      name: 'Test Admin',
      isSuperAdmin: true,
    },
  });
  console.log('Created test user:', testUser.email);

  // Create cities
  const nyc = await prisma.city.create({
    data: {
      name: 'New York',
      state: 'NY',
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.006,
    },
  });

  const la = await prisma.city.create({
    data: {
      name: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      latitude: 34.0522,
      longitude: -118.2437,
    },
  });

  const chicago = await prisma.city.create({
    data: {
      name: 'Chicago',
      state: 'IL',
      country: 'USA',
      latitude: 41.8781,
      longitude: -87.6298,
    },
  });

  console.log('Created cities:', nyc.name, la.name, chicago.name);

  // Create venues
  const venues = await Promise.all([
    // NYC venues
    prisma.venue.create({
      data: {
        name: 'The Grand Hall',
        address: '123 Broadway, New York, NY 10001',
        cityId: nyc.id,
        latitude: 40.7484,
        longitude: -73.9857,
      },
    }),
    prisma.venue.create({
      data: {
        name: 'Brooklyn Arena',
        address: '456 Atlantic Ave, Brooklyn, NY 11217',
        cityId: nyc.id,
        latitude: 40.6826,
        longitude: -73.9754,
      },
    }),
    // LA venues
    prisma.venue.create({
      data: {
        name: 'Sunset Lounge',
        address: '789 Sunset Blvd, Los Angeles, CA 90028',
        cityId: la.id,
        latitude: 34.0928,
        longitude: -118.3287,
      },
    }),
    prisma.venue.create({
      data: {
        name: 'Downtown LA Center',
        address: '100 Grand Ave, Los Angeles, CA 90012',
        cityId: la.id,
        latitude: 34.0553,
        longitude: -118.2498,
      },
    }),
    // Chicago venues
    prisma.venue.create({
      data: {
        name: 'Windy City Hall',
        address: '200 Michigan Ave, Chicago, IL 60601',
        cityId: chicago.id,
        latitude: 41.8827,
        longitude: -87.6233,
      },
    }),
    prisma.venue.create({
      data: {
        name: 'Lakefront Pavilion',
        address: '300 Lake Shore Dr, Chicago, IL 60611',
        cityId: chicago.id,
        latitude: 41.8917,
        longitude: -87.6086,
      },
    }),
  ]);

  console.log('Created', venues.length, 'venues');

  // Make test user owner of all venues
  for (const venue of venues) {
    await prisma.venueStaff.create({
      data: {
        userId: testUser.id,
        venueId: venue.id,
        role: 'OWNER',
      },
    });
  }
  console.log('Added test user as owner of all venues');

  // Create communities
  const communities = await Promise.all([
    // NYC communities
    prisma.community.create({
      data: {
        name: 'NYC Pool Players',
        description: 'The best pool players in New York City',
        cityId: nyc.id,
      },
    }),
    prisma.community.create({
      data: {
        name: 'Manhattan Billiards Club',
        description: 'Casual and competitive billiards in Manhattan',
        cityId: nyc.id,
      },
    }),
    // LA communities
    prisma.community.create({
      data: {
        name: 'LA Cue Sports',
        description: 'Los Angeles cue sports enthusiasts',
        cityId: la.id,
      },
    }),
    prisma.community.create({
      data: {
        name: 'Hollywood Pool League',
        description: 'Weekly pool tournaments in Hollywood',
        cityId: la.id,
      },
    }),
    // Chicago communities
    prisma.community.create({
      data: {
        name: 'Chicago Billiards Society',
        description: 'Premier billiards community in the Windy City',
        cityId: chicago.id,
      },
    }),
    prisma.community.create({
      data: {
        name: 'Midwest Pool Tour',
        description: 'Competitive pool across the Midwest',
        cityId: chicago.id,
      },
    }),
  ]);

  console.log('Created', communities.length, 'communities');

  // Add test user to all communities
  for (const community of communities) {
    await prisma.communityMember.create({
      data: {
        userId: testUser.id,
        communityId: community.id,
      },
    });
  }
  console.log('Added test user to all communities');

  // Create events (future dates)
  const now = new Date();
  const events = await Promise.all([
    // NYC events
    prisma.event.create({
      data: {
        title: 'Weekly 9-Ball Tournament',
        description: 'Join us for our weekly 9-ball tournament. All skill levels welcome!',
        startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // 4 hours duration
        venueId: venues[0].id,
        communityId: communities[0].id,
        creatorId: testUser.id,
      },
    }),
    prisma.event.create({
      data: {
        title: 'Beginner Pool Night',
        description: 'Learn the basics of pool in a friendly environment',
        startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        venueId: venues[1].id,
        communityId: communities[1].id,
        creatorId: testUser.id,
      },
    }),
    // LA events
    prisma.event.create({
      data: {
        title: 'Sunset Pool Party',
        description: 'Pool and drinks at sunset',
        startTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        venueId: venues[2].id,
        communityId: communities[2].id,
        creatorId: testUser.id,
      },
    }),
    prisma.event.create({
      data: {
        title: 'Hollywood Championship',
        description: 'Annual championship tournament',
        startTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        endTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        venueId: venues[3].id,
        communityId: communities[3].id,
        creatorId: testUser.id,
      },
    }),
    // Chicago events
    prisma.event.create({
      data: {
        title: 'Windy City Open',
        description: 'Open tournament for all Chicago players',
        startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
        venueId: venues[4].id,
        communityId: communities[4].id,
        creatorId: testUser.id,
      },
    }),
    prisma.event.create({
      data: {
        title: 'Lakefront League Night',
        description: 'Weekly league matches by the lake',
        startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        endTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        venueId: venues[5].id,
        communityId: communities[5].id,
        creatorId: testUser.id,
      },
    }),
  ]);

  console.log('Created', events.length, 'events');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
