ALTER TABLE theme
  ADD CONSTRAINT colors_jsonb_is_object CHECK (jsonb_typeof(colors) = 'object'),
  ADD CONSTRAINT typography_jsonb_is_object CHECK (jsonb_typeof(typography) = 'object'),
  ADD CONSTRAINT spacing_jsonb_is_object CHECK (jsonb_typeof(spacing) = 'object'),
  ADD CONSTRAINT shadows_jsonb_is_object CHECK (jsonb_typeof(shadows) = 'object'),
  ADD CONSTRAINT border_radius_jsonb_is_object CHECK (jsonb_typeof(borderRadius) = 'object'),
  ADD CONSTRAINT backgrounds_jsonb_is_object CHECK (jsonb_typeof(backgrounds) = 'object');
