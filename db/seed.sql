insert into designers (name, rr_order) values
 ('Aryan',0),('Meera',1),('Reyansh',2),('Ishita',3),('Kabir',4),('Ananya',5),('Vihaan',6),
 ('Tara',7),('Samar',8),('Nandini',9),('Advait',10),('Kavya',11),('Dev',12),('Riya',13)
on conflict (name) do nothing;
insert into rr_state (id, next_index) values (1, 0) on conflict (id) do nothing;
