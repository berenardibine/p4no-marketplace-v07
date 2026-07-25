
-- Function to create admin notification
CREATE OR REPLACE FUNCTION public.create_admin_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _module text;
  _title text;
  _message text;
BEGIN
  -- Determine module and message based on trigger table
  CASE TG_TABLE_NAME
    WHEN 'orders' THEN
      _module := 'orders';
      _title := 'New Order Received';
      _message := 'Order from ' || NEW.buyer_name || ' (' || NEW.buyer_phone || ')';
    WHEN 'contact_messages' THEN
      _module := 'messages';
      _title := 'New Support Message';
      _message := 'Message from ' || NEW.name || ': ' || LEFT(NEW.message, 100);
    WHEN 'product_comments' THEN
      _module := 'comments';
      _title := 'New Product Comment';
      _message := NEW.author_name || ' commented: ' || LEFT(NEW.content, 100);
    WHEN 'identity_verifications' THEN
      _module := 'verifications';
      _title := 'New Verification Request';
      _message := 'A seller submitted identity verification for review.';
    WHEN 'task_submissions' THEN
      _module := 'tasks';
      _title := 'New Task Submission';
      _message := 'A user submitted a task for review.';
    WHEN 'products' THEN
      IF NEW.status = 'pending' THEN
        _module := 'products';
        _title := 'New Product Listed';
        _message := 'Product "' || LEFT(NEW.title, 80) || '" needs review.';
      ELSE
        RETURN NEW;
      END IF;
    WHEN 'boosted_products' THEN
      _module := 'boosts';
      _title := 'New Boost Request';
      _message := 'A seller requested a product boost for approval.';
    WHEN 'product_requests' THEN
      _module := 'orders';
      _title := 'New Product Request';
      _message := 'Request from ' || NEW.buyer_name || ' for a product.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, title, message, type, module, is_read)
  VALUES (NULL, _title, _message, 'admin', _module, false);

  RETURN NEW;
END;
$$;

-- Create triggers for each table
DROP TRIGGER IF EXISTS notify_admin_on_order ON public.orders;
CREATE TRIGGER notify_admin_on_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_admin_notification();

DROP TRIGGER IF EXISTS notify_admin_on_contact ON public.contact_messages;
CREATE TRIGGER notify_admin_on_contact
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.create_admin_notification();

DROP TRIGGER IF EXISTS notify_admin_on_comment ON public.product_comments;
CREATE TRIGGER notify_admin_on_comment
  AFTER INSERT ON public.product_comments
  FOR EACH ROW EXECUTE FUNCTION public.create_admin_notification();

DROP TRIGGER IF EXISTS notify_admin_on_verification ON public.identity_verifications;
CREATE TRIGGER notify_admin_on_verification
  AFTER INSERT ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.create_admin_notification();

DROP TRIGGER IF EXISTS notify_admin_on_product ON public.products;
CREATE TRIGGER notify_admin_on_product
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.create_admin_notification();

DROP TRIGGER IF EXISTS notify_admin_on_boost ON public.boosted_products;
CREATE TRIGGER notify_admin_on_boost
  AFTER INSERT ON public.boosted_products
  FOR EACH ROW EXECUTE FUNCTION public.create_admin_notification();

DROP TRIGGER IF EXISTS notify_admin_on_request ON public.product_requests;
CREATE TRIGGER notify_admin_on_request
  AFTER INSERT ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_admin_notification();
