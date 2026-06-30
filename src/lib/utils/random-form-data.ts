export function generateRandomData(participantCount: number = 3) {
  const firstNames = ['Budi', 'Siti', 'Andi', 'Dewi', 'Rudi', 'Sari', 'Agus', 'Wati', 'Dedi', 'Yanti']
  const lastNames = ['Santoso', 'Wijaya', 'Putra', 'Permata', 'Hidayat', 'Lestari', 'Pratama', 'Wardani', 'Maulana', 'Sari']
  const cities = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Bekasi', 'Tangerang', 'Depok']
  const provinces = ['DKI Jakarta', 'Jawa Timur', 'Jawa Barat', 'Sumatera Utara', 'Jawa Tengah', 'Sulawesi Selatan', 'Sumatera Selatan', 'Banten']
  const districts = ['Cengkareng', 'Kedoya', 'Ciputat', 'Tebet', 'Pancoran', 'Mampang Prapatan', 'Setiabudi', 'Kebayoran Baru']
  const bloodTypes = ['A', 'B', 'AB', 'O'] as const
  const shirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'] as const
  const genders = ['male', 'female'] as const

  const randomFirstName = () => firstNames[Math.floor(Math.random() * firstNames.length)]
  const randomLastName = () => lastNames[Math.floor(Math.random() * lastNames.length)]
  const randomPhone = () => '08' + Math.floor(1000000000 + Math.random() * 9000000000).toString()
  const randomEmail = (name: string) => `${name.toLowerCase().replace(/\s/g, '')}${Math.floor(Math.random() * 1000)}@example.com`
  const randomCity = () => cities[Math.floor(Math.random() * cities.length)]
  const randomProvince = () => provinces[Math.floor(Math.random() * provinces.length)]
  const randomDistrict = () => districts[Math.floor(Math.random() * districts.length)]
  const randomGender = () => genders[Math.floor(Math.random() * genders.length)]
  const randomShirtSize = () => shirtSizes[Math.floor(Math.random() * shirtSizes.length)]
  const randomBloodType = () => bloodTypes[Math.floor(Math.random() * bloodTypes.length)]

  const leaderFirstName = randomFirstName()
  const leaderLastName = randomLastName()
  const leaderName = `${leaderFirstName} ${leaderLastName}`

  const participants = Array.from({ length: participantCount }, () => {
    const firstName = randomFirstName()
    const lastName = randomLastName()
    return {
      full_name: `${firstName} ${lastName}`,
      bib_name: firstName.toUpperCase().slice(0, 10),
      email: randomEmail(firstName),
      phone: randomPhone(),
      date_of_birth: `${1990 + Math.floor(Math.random() * 30)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      gender: randomGender(),
      tshirt_size: randomShirtSize(),
      blood_type: randomBloodType(),
      medical_condition: '',
      emergency_contact_name: `${randomFirstName()} ${randomLastName()}`,
      emergency_contact_phone: randomPhone()
    }
  })

  return {
    name: `Grup ${leaderFirstName} Family`,
    leader_name: leaderName,
    phone: randomPhone(),
    email: randomEmail(leaderFirstName),
    category: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000' as const,
    provinsi: randomProvince(),
    kota: randomCity(),
    kecamatan: randomDistrict(),
    password: 'password123',
    confirmPassword: 'password123',
    participants,
    agreement_safety: true,
    agreement_data: true,
    agreement_refund: true
  }
}