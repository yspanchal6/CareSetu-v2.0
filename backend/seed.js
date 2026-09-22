const prisma = require('./src/config/prisma.js');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Clearing old seed data...');
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.hospitalRequest.deleteMany({});
  await prisma.emergencyCase.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.hospital.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('hospital123', 10);

  console.log('Seeding Patient...');
  const patientUser = await prisma.user.create({
    data: {
      name: 'John Patient',
      email: 'patient@test.com',
      password: await bcrypt.hash('password123', 10),
      role: 'PATIENT',
      patient: {
        create: {
          name: 'John Patient',
          age: 30,
          gender: 'M',
          phone: '+919876543210',
          location: { latitude: 23.0225, longitude: 72.5714 } // Ahmedabad
        }
      }
    },
    include: { patient: true }
  });

  const healthPackService = require('./src/services/health-pack.service');
  const sampleHealthData = {
    bloodType: 'O+',
    allergies: ['Penicillin', 'Peanuts'],
    medicalHistory: ['Hypertension'],
    emergencyContacts: [{ name: 'Jane Patient', phone: '+919876543210', relation: 'Spouse' }]
  };
  await healthPackService.createHealthPack(patientUser.patient.id, sampleHealthData);

  console.log('Seeding Hospitals...');

  // 1. Shree Krishna Hospital (Karamsad)
  await prisma.user.create({
    data: {
      name: 'Shree Krishna Hospital',
      email: 'shreekrishna@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Shree Krishna Hospital',
          address: 'Gokal Nagar, Karamsad, Anand, Gujarat 388325',
          city: 'Karamsad',
          state: 'Gujarat',
          phone: '+912692228411',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          hasCardiology: true,
          hasTraumaUnit: true,
          hasICU: true,
          capabilities: ["Emergency", "Cardiac", "Trauma", "ICU", "Multi-specialty"],
          location: { latitude: 22.5352, longitude: 72.8943 }
        }
      }
    }
  });

  // 2. Anand Multispeciality Hospital (Anand)
  await prisma.user.create({
    data: {
      name: 'Anand Multispeciality Hospital',
      email: 'anandmulti@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Anand Multispeciality Hospital',
          address: 'Station Road, Anand, Gujarat 388001',
          city: 'Anand',
          state: 'Gujarat',
          phone: '+912692222222',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          hasCardiology: true,
          hasICU: true,
          capabilities: ["Emergency", "Cardiac", "Orthopedic", "ICU"],
          location: { latitude: 22.5605, longitude: 72.9284 }
        }
      }
    }
  });

  // 3. Civil Hospital Anand (Anand)
  await prisma.user.create({
    data: {
      name: 'Civil Hospital Anand',
      email: 'civilanand@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Civil Hospital Anand',
          address: 'Near Anand Bus Stand, Anand, Gujarat 388001',
          city: 'Anand',
          state: 'Gujarat',
          phone: '+912692333333',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          capabilities: ["Emergency", "General"],
          location: { latitude: 22.5645, longitude: 72.9289 }
        }
      }
    }
  });

  // 4. Zydus Hospital, Anand
  await prisma.user.create({
    data: {
      name: 'Zydus Hospital, Anand',
      email: 'zydus@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Zydus Hospital, Anand',
          address: 'Anand-Lambhvel Road, Zydus Rd, Nanikhodiyar, Anand, Gujarat 388001',
          city: 'Anand',
          state: 'Gujarat',
          phone: '+912692444400',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          hasCardiology: true,
          hasNeurology: true,
          hasICU: true,
          capabilities: ["Emergency", "Cardiac", "Neurology", "Oncology", "Orthopedics", "ICU", "Multi-specialty"],
          location: { latitude: 22.566719, longitude: 72.9458388 }
        }
      }
    }
  });

  // 5. IRIS Hospital, Anand
  await prisma.user.create({
    data: {
      name: 'IRIS Hospital, Anand',
      email: 'iris@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'IRIS Hospital, Anand',
          address: 'Lambhvel Rd, Patel Chokdi, Purushottam Nagar, Anand, Gujarat 388001',
          city: 'Anand',
          state: 'Gujarat',
          phone: '+912692444401',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          capabilities: ["Emergency", "Orthopedics", "Gastroenterology", "ENT", "Dental", "Multi-specialty"],
          location: { latitude: 22.56444, longitude: 72.94568 }
        }
      }
    }
  });

  // 6. Sardar Patel University Health Centre (Vallabh Vidyanagar)
  await prisma.user.create({
    data: {
      name: 'Sardar Patel University Health Centre',
      email: 'spuhealth@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Sardar Patel University Health Centre',
          address: 'Vallabh Vidyanagar, Anand, Gujarat 388120',
          city: 'Anand',
          state: 'Gujarat',
          phone: '+912692444444',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          capabilities: ["Emergency", "General", "Orthopedic"],
          location: { latitude: 22.5290, longitude: 72.9189 }
        }
      }
    }
  });

  // 7. Nadiad Civil Hospital (Nadiad)
  await prisma.user.create({
    data: {
      name: 'Nadiad Civil Hospital',
      email: 'civilnadiad@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Nadiad Civil Hospital',
          address: 'Near Railway Station, Nadiad, Gujarat 387001',
          city: 'Nadiad',
          state: 'Gujarat',
          phone: '+912692555555',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          hasCardiology: true,
          hasTraumaUnit: true,
          hasICU: true,
          capabilities: ["Emergency", "Cardiac", "Trauma", "ICU"],
          location: { latitude: 22.6939, longitude: 72.8619 }
        }
      }
    }
  });

  // 8. Muljibhai Patel Urological Hospital (MPUH, Nadiad)
  await prisma.user.create({
    data: {
      name: 'Muljibhai Patel Urological Hospital',
      email: 'mpuh@caresetu.com',
      password: passwordHash,
      role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Muljibhai Patel Urological Hospital',
          address: 'Dr. Virendra Desai Road, Nadiad, Gujarat 387001',
          city: 'Nadiad',
          state: 'Gujarat',
          phone: '+912692666666',
          emergencyAvailable: true,
          hasEmergencyDepartment: true,
          hasICU: true,
          capabilities: ["Emergency", "Urology", "Nephrology", "ICU"],
          location: { latitude: 22.6878, longitude: 72.8642 }
        }
      }
    }
  });

  console.log('Seeding Admin...');
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@caresetu.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN'
    }
  });

  console.log('Seed successful!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
