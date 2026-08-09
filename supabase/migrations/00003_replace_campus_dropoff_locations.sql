
-- Remove old demo locations
DELETE FROM public.campus_dropoff_locations;

-- Insert all real campus dropoff locations
INSERT INTO public.campus_dropoff_locations (location_name) VALUES
  ('Main Gate'),
  ('Marque'),
  ('New Horizon'),
  ('Friendship Centre'),
  ('College of Postgraduate Studies (Coleman Wire and Cables Building)'),
  ('Consult Building'),
  ('ELT'),
  ('Alhaji Ahmed Joda Hall (Uptown Bronze Annex)'),
  ('Recreational Centre'),
  ('Science Laboratory'),
  ('Nutrition and Dietetics Laboratory'),
  ('Registry'),
  ('BUPF'),
  ('Senate Building – Prof. Julius A. Okojie Admin Building'),
  ('Adenuga Building'),
  ('Clinic'),
  ('Female Silver Hostel (Chief Mrs Toyin Olakunri Hall)'),
  ('Silver 1 Hostel (Prof. Akin L. Mabogunje Hall)'),
  ('Main Bronze Hostel (Rev. Dr. Wilson A. Badejo Hall)'),
  ('Classrooms – Back of WEMA'),
  ('Emerald 1 Hall'),
  ('Hall B Hostel (Prof. Tekena Tamuno Hall)'),
  ('College of Engineering Annex'),
  ('College of Management Science'),
  ('College of Engineering'),
  ('College of Environmental Science'),
  ('Lecture Theatre'),
  ('BUPF Lecture Theatre'),
  ('Glass House'),
  ('Silver 2 Hostel (Prof. Oladipi Oluyimi Akinkugbe Hall)'),
  ('Silver 3 Hostel (Dr. Emmanuel E.G. Ogah Hall)'),
  ('Female New Hall (Mrs Olugbolahan Abisogun-Alo Hall)'),
  ('Male New Hall (Adebayo Adeyemi Hall)');
