-- Create a function that makes the first profile created an admin
CREATE OR REPLACE FUNCTION public.promote_first_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.profiles) = 1 THEN
    UPDATE public.profiles SET is_admin = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_promote_first_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_first_user();