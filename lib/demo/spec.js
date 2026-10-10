// Dummy data for the demo: who the customers are, which projects each designer is running, and which leads are open.
// Everything here is made up. Names are invented, phone numbers use a block that is not meant for real people,
// and every row written from this file is flagged is_demo so one command can remove it.

// [designer, customer, area, type, size_sqft, stage, value_lakh, source, notes]
export const PROJECTS = [
  // Aryan: the use case we walk through, so five projects at every stage
  ['Aryan', 'Priya and Rohit Deshmukh', 'Baner', '3BHK full home', 1380, 'execution', 14.5, 'referral: Shruti Joshi', 'Wants a warm, wooden look. Rohit works from home, so a proper study corner was a must.'],
  ['Aryan', 'Neha Gokhale', 'Kothrud', '2BHK full home', 980, 'design', 10.2, 'Instagram', 'First home. Likes light colours and open shelving. Husband travels, so video calls for approvals.'],
  ['Aryan', 'Amit and Kavita Phadke', 'Aundh', '3BHK full home', 1450, 'approvals', 13.8, 'Google search', 'Two school-going kids. Wants a study wall and a lot of closed storage.'],
  ['Aryan', 'Dr Sameer Bapat', 'Wakad', '4BHK full home', 2050, 'execution', 24.5, 'referral: builder tie-up', 'Doctor couple. Home clinic room near the entrance with a separate door.'],
  ['Aryan', 'Rajesh Mehta', 'Viman Nagar', '2BHK full home with study', 1050, 'handover', 11.0, 'walk-in', 'Possession was late, so the timeline was tight. Almost done, final snag list pending.'],

  ['Meera', 'Anjali and Karan Shah', 'Koregaon Park', '3BHK full home', 1600, 'execution', 19.0, 'referral: Mehul Jain', 'Modern, monochrome with brass accents. Open kitchen with an island.'],
  ['Meera', 'Pooja Kulkarni', 'Kalyani Nagar', '2BHK full home', 920, 'finishing', 9.4, 'Instagram', 'Compact flat, lots of hidden storage. Pastel palette.'],
  ['Meera', 'Harshad Joshi', 'Hadapsar', '3BHK full home', 1250, 'design', 12.0, 'hoarding', 'Joint family. Elder parents need a ground-friendly bedroom layout.'],

  ['Reyansh', 'Sunita and Vijay Patil', 'Pimple Saudagar', 'villa full design', 3400, 'execution', 38.0, 'referral: past client', 'Three floors. Courtyard, pooja room and a home theatre are the priorities.'],
  ['Reyansh', 'Imran and Zoya Sheikh', 'Kondhwa', '3BHK full home', 1320, 'design', 11.8, 'Instagram', 'Likes Moroccan tiles and deep blues. Needs a large dining table for family gatherings.'],
  ['Reyansh', 'Tanvi Naik', 'NIBM', '2BHK kitchen, wardrobes and living', 960, 'handover', 7.5, 'Google search', 'Partial scope: kitchen, wardrobes and living room only.'],

  ['Ishita', 'Rohan and Meghna Kapoor', 'Magarpatta', '3BHK full home', 1500, 'execution', 16.0, 'builder tie-up', 'Possession-ready flat. Wants it livable before the in-laws arrive.'],
  ['Ishita', 'Dr Lata Karve', 'Deccan', '2BHK full home', 880, 'finishing', 10.5, 'referral: Dr Apte', 'Old flat renovation. Kept the teak door frames and reused the old almirah.'],
  ['Ishita', 'Siddharth Iyer', 'Baner', '1BHK with home office', 640, 'design', 6.8, 'Instagram', 'Software engineer. Fold-away desk and good lighting for calls.'],

  ['Kabir', 'Mehul Jain', 'Kothrud', 'office fitout', 1800, 'execution', 17.5, 'referral: past client', 'Twenty-five seats, two cabins and a small pantry. Needs to move in by month end.'],
  ['Kabir', 'Farah and Nadeem Khan', 'Undri', '3BHK full home', 1280, 'approvals', 12.2, 'Instagram', 'Wants a big open kitchen. Layout signed, waiting on material choices.'],
  ['Kabir', 'Deepa Sathe', 'Warje', '2BHK full home', 900, 'handover', 9.2, 'Google search', 'Tight budget handled with a simple palette. Handover this week.'],

  ['Ananya', 'Vikram and Radhika Chavan', 'Hinjewadi', '3BHK full home', 1420, 'execution', 14.2, 'Instagram', 'Both work in IT, so a clean look and fast execution. Smart switches throughout.'],
  ['Ananya', 'Gauri Oak', 'Erandwane', '2BHK full home', 1000, 'design', 10.8, 'referral: past client', 'Vintage furniture to be reused. Wants it to feel like her grandmother\'s house, but fresh.'],
  ['Ananya', 'Ashwin Reddy', 'Viman Nagar', '3BHK full home', 1380, 'finishing', 13.6, 'referral: builder tie-up', 'Painting done, loose furniture and lighting going in.'],

  ['Vihaan', 'Manisha and Prakash Bhosale', 'Ravet', '3BHK full home', 1250, 'execution', 12.8, 'hoarding', 'Wants a pooja unit in the living room and a play area for a toddler.'],
  ['Vihaan', 'Aditya Menon', 'Kalyani Nagar', '4BHK full home', 2300, 'approvals', 26.0, 'referral: past client', 'Large home. Walk-in wardrobe for master, home bar in the family room.'],
  ['Vihaan', 'Shweta Pawar', 'Pimpri', '2BHK full home', 860, 'design', 8.4, 'Instagram', 'Budget-conscious. Prioritising kitchen and wardrobes first.'],

  ['Tara', 'Nitin and Shilpa Agarwal', 'Aundh', '3BHK full home', 1500, 'execution', 15.5, 'Google search', 'Prefers Italian-look flooring and a dark wood TV unit.'],
  ['Tara', 'Dr Ritu Banerjee', 'Koregaon Park', '2BHK full home', 1100, 'finishing', 12.4, 'referral: Dr Karve', 'Book-lover. Floor-to-ceiling library wall in the living room.'],
  ['Tara', 'Omkar Ranade', 'Wakad', '2BHK full home', 940, 'design', 9.1, 'Instagram', 'Young couple. Wants a gaming corner and a compact home gym.'],

  ['Samar', 'Sanjay and Mala Naidu', 'Hadapsar', '3BHK full home', 1300, 'execution', 13.0, 'builder tie-up', 'Straightforward brief. Customer travels often, so site updates by photo.'],
  ['Samar', 'Pallavi Shinde', 'Warje', '2BHK full home', 870, 'approvals', 8.8, 'Instagram', 'Layout approved. Choosing between two kitchen finishes.'],
  ['Samar', 'Gaurav Bansal', 'Baner', 'office fitout', 1200, 'handover', 13.2, 'referral: past client', 'Fifteen-seat startup office. Final lighting and signage pending.'],

  ['Nandini', 'Jayesh and Hetal Gandhi', 'Kothrud', '3BHK full home', 1420, 'execution', 15.0, 'referral: past client', 'Vegetarian household. Wants a large, well-ventilated kitchen and a puja corner.'],
  ['Nandini', 'Maria and Joseph D\'Souza', 'Viman Nagar', '3BHK full home', 1350, 'finishing', 14.0, 'Google search', 'Cane furniture and soft whites. Balcony turned into a reading nook.'],
  ['Nandini', 'Chetan Wagh', 'Pimple Saudagar', '2BHK full home', 910, 'design', 9.6, 'Instagram', 'Likes industrial style, exposed textures and black fittings.'],

  ['Advait', 'Rahul and Smita Sapre', 'NIBM', '3BHK full home', 1280, 'execution', 13.4, 'Instagram', 'Grandparents live with them. Anti-skid flooring and grab bars in the bathrooms.'],
  ['Advait', 'Kunal Khanna', 'Magarpatta', '4BHK full home', 2100, 'design', 22.0, 'referral: past client', 'Wants a statement living room with double-height feel and a bar unit.'],
  ['Advait', 'Lalita Pandit', 'Deccan', '2BHK full home', 800, 'handover', 8.9, 'referral: Dr Karve', 'Senior citizen, living alone. Simple, safe and easy to clean.'],

  ['Kavya', 'Arjun and Divya Nair', 'Wakad', '3BHK full home', 1360, 'execution', 14.4, 'Instagram', 'Likes Kerala-style wood accents with a modern layout.'],
  ['Kavya', 'Madhuri Kelkar', 'Erandwane', '2BHK full home', 950, 'finishing', 10.0, 'referral: past client', 'Traditional taste. Wooden swing in the balcony, brass details.'],
  ['Kavya', 'Yash Thakur', 'Kondhwa', '3BHK full home', 1200, 'approvals', 11.2, 'Google search', 'Waiting on the society for permission for the balcony grill change.'],

  ['Dev', 'Pranav and Isha Joshi', 'Baner', 'villa full design', 4200, 'execution', 44.0, 'referral: builder tie-up', 'Two floors plus terrace. Large kitchen, pooja room, and a terrace lounge.'],
  ['Dev', 'Sakshi Dalvi', 'Undri', '2BHK full home', 900, 'design', 9.3, 'Instagram', 'Bright colours, lots of plants, and a window seat in the bedroom.'],
  ['Dev', 'Naveen Pillai', 'Hinjewadi', '2BHK full home', 1020, 'handover', 10.6, 'hoarding', 'Rented out after handover, so durable finishes were chosen.'],

  ['Riya', 'Abhishek and Rhea Malhotra', 'Koregaon Park', '3BHK full home', 1700, 'execution', 18.5, 'referral: past client', 'Entertaining space is the priority. Bar counter and a large dining table.'],
  ['Riya', 'Rekha Gadgil', 'Kothrud', '2BHK full home', 940, 'approvals', 9.8, 'referral: past client', 'Elderly couple. Wants a simple layout with a ground-friendly bedroom.'],
  ['Riya', 'Tejas Mane', 'Ravet', '3BHK full home', 1240, 'design', 11.4, 'Instagram', 'First home. Wants a modern look but with a traditional mandir wall.'],
];

// Open leads in each designer's pipeline: [designer, caller, area, type, size, status, hoursAgo, referral, weeks, source]
export const LEADS = [
  ['Aryan', 'Neelam Joshi', 'Aundh', '3BHK full home', 1400, 'new', 3, true, 20, 'referral: Priya Deshmukh'],
  ['Aryan', 'Suresh Kulkarni', 'Baner', '2BHK full home', 980, 'accepted', 20, false, 14, 'Instagram'],
  ['Aryan', 'Harleen and Gurpreet Singh', 'Viman Nagar', '3BHK full home', 1500, 'called', 52, false, 10, 'Google search'],
  ['Aryan', 'Mrunal Sathe', 'Kothrud', '4BHK full home', 2200, 'proposal', 300, true, 12, 'referral: Dr Bapat'],

  ['Meera', 'Ravi Pillai', 'Magarpatta', '3BHK full home', 1300, 'new', 5, false, 18, 'Instagram'],
  ['Meera', 'Alka Deshpande', 'Koregaon Park', '2BHK full home', 1100, 'proposal', 260, true, 10, 'referral: Anjali Shah'],
  ['Reyansh', 'Kiran Rao', 'Hinjewadi', '3BHK full home', 1350, 'accepted', 26, false, 16, 'Instagram'],
  ['Reyansh', 'Fatima Qureshi', 'Kondhwa', '2BHK full home', 900, 'held', 130, false, 12, 'Google search'],
  ['Ishita', 'Varun and Isha Seth', 'Baner', '3BHK full home', 1450, 'new', 2, true, 8, 'referral: past client'],
  ['Ishita', 'Madhav Kale', 'Deccan', '2BHK full home', 850, 'called', 60, false, 20, 'Instagram'],
  ['Kabir', 'Smita Barve', 'Warje', '3BHK full home', 1250, 'accepted', 30, false, 15, 'hoarding'],
  ['Kabir', 'Techwave Solutions', 'Kothrud', 'office fitout', 2400, 'new', 4, false, 8, 'referral: Mehul Jain'],
  ['Ananya', 'Shruti and Akash Verma', 'Hinjewadi', '2BHK full home', 1000, 'called', 70, false, 14, 'Instagram'],
  ['Ananya', 'Bhavna Chopra', 'Erandwane', '3BHK full home', 1300, 'new', 6, false, 22, 'Google search'],
  ['Vihaan', 'Dinesh and Leena Hegde', 'Ravet', '3BHK full home', 1280, 'accepted', 22, false, 18, 'Instagram'],
  ['Vihaan', 'Mohit Arora', 'Pimpri', '2BHK full home', 870, 'held', 140, false, 16, 'Google search'],
  ['Tara', 'Pradnya Lokhande', 'Aundh', '3BHK full home', 1450, 'new', 1, true, 6, 'referral: Dr Banerjee'],
  ['Tara', 'Karthik and Divya Menon', 'Wakad', '3BHK full home', 1380, 'called', 48, false, 12, 'Instagram'],
  ['Samar', 'Anita Dixit', 'Hadapsar', '2BHK full home', 960, 'accepted', 28, false, 14, 'Instagram'],
  ['Samar', 'Prashant Joglekar', 'Baner', '3BHK full home', 1500, 'proposal', 240, true, 12, 'referral: past client'],
  ['Nandini', 'Ritesh and Poonam Mishra', 'Kothrud', '2BHK full home', 1020, 'new', 3, false, 20, 'Google search'],
  ['Nandini', 'Amol Bhide', 'Pimple Saudagar', '3BHK full home', 1320, 'called', 55, false, 14, 'Instagram'],
  ['Advait', 'Nisha Rajput', 'NIBM', '3BHK full home', 1250, 'accepted', 25, false, 16, 'Instagram'],
  ['Advait', 'Gopal Kamat', 'Magarpatta', 'villa full design', 3600, 'new', 2, true, 24, 'referral: Kunal Khanna'],
  ['Kavya', 'Swati and Hemant Gupta', 'Wakad', '3BHK full home', 1400, 'called', 66, false, 12, 'Google search'],
  ['Kavya', 'Rutuja Salvi', 'Erandwane', '2BHK full home', 900, 'new', 7, false, 18, 'Instagram'],
  ['Dev', 'Vivek Anand', 'Baner', '4BHK full home', 2000, 'accepted', 24, true, 10, 'referral: Pranav Joshi'],
  ['Dev', 'Ketaki Marathe', 'Undri', '2BHK full home', 880, 'new', 5, false, 20, 'Instagram'],
  ['Riya', 'Zubin and Arnaz Irani', 'Koregaon Park', '3BHK full home', 1650, 'held', 150, true, 9, 'referral: past client'],
  ['Riya', 'Sagar Thorat', 'Kothrud', '2BHK full home', 940, 'called', 58, false, 15, 'Instagram'],
];

// Calls the voice agent did not book: declined, escalated, missed, info only. minutesAgo is from now.
export const OTHER_CALLS = [
  { outcome: 'declined', kind: 'outside_area', name: 'Suresh Patil', area: 'Nashik', type: 'home office', minutesAgo: 95, reviewed: false },
  { outcome: 'declined', kind: 'advice_only', name: 'Anuja Karandikar', area: 'Kothrud', type: 'living room refresh', minutesAgo: 210, reviewed: false },
  { outcome: 'declined', kind: 'timeline', name: 'Gaurang Shah', area: 'Pune', type: 'living room and kitchen', minutesAgo: 620, reviewed: false },
  { outcome: 'declined', kind: 'restaurant', name: 'Cafe owner', area: 'Koregaon Park', type: 'restaurant interiors', minutesAgo: 1900, reviewed: true },
  { outcome: 'declined', kind: 'outside_area', name: 'Meenal Sawant', area: 'Lonavala', type: 'weekend bungalow', minutesAgo: 2600, reviewed: true },
  { outcome: 'escalated', kind: 'silent_designer', name: 'Sheetal Deshpande', area: 'Viman Nagar', type: '2BHK full home', minutesAgo: 6, done: false },
  { outcome: 'escalated', kind: 'delay_complaint', name: 'Prakash Naik', area: 'Hadapsar', type: '3BHK full home', minutesAgo: 3000, done: true },
  { outcome: 'missed', kind: 'dropped', name: null, area: null, type: null, minutesAgo: 40, done: false },
  { outcome: 'missed', kind: 'dropped', name: null, area: null, type: null, minutesAgo: 2900, done: true },
  { outcome: 'info_only', kind: 'vendor', name: 'Rakesh (tile supplier)', area: null, type: null, minutesAgo: 1500 },
  { outcome: 'info_only', kind: 'job_seeker', name: 'Mansi Gadre', area: null, type: null, minutesAgo: 4300 },
];

export const SOCIETIES = ['Orchid Residency', 'Shree Nivas', 'Skyline Heights', 'Lake View Towers', 'Raj Palms', 'The Grove', 'Magnolia Heights', 'Green Meadows',
  'Sai Srushti', 'Palm Court', 'Aangan Greens', 'Vrindavan Park', 'Sunrise Enclave', 'Silver Oaks', 'Heritage Arcade', 'Blue Ridge Homes', 'Kalpavruksh', 'Nisarg Residency',
  'Pearl Towers', 'Utsav Apartments', 'Gandhar Heights', 'Maple Leaf Society', 'Riverside Court', 'Ashiana', 'Tulip Gardens', 'Samarth Plaza', 'Bhairav Vihar', 'Neelkanth Heights'];

export const PINCODES = {
  Baner: '411045', Kothrud: '411038', Aundh: '411007', Wakad: '411057', 'Koregaon Park': '411001', 'Kalyani Nagar': '411006',
  'Viman Nagar': '411014', Hadapsar: '411028', Magarpatta: '411028', NIBM: '411048', Kondhwa: '411048', Undri: '411060', Warje: '411058',
  Erandwane: '411004', Deccan: '411004', 'Pimple Saudagar': '411027', Ravet: '412101', Hinjewadi: '411057', Pimpri: '411018',
};
