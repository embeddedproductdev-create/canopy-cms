import * as migration_20250929_111647 from './20250929_111647';
import * as migration_20260930_070407_footer_content_json from './20260930_070407_footer_content_json';
import * as migration_20260930_071837_testimonial_collection from './20260930_071837_testimonial_collection';
import * as migration_20260930_193000_typed_content_model from './20260930_193000_typed_content_model';
import * as migration_20260930_201500_section_mapping_fields from './20260930_201500_section_mapping_fields';

export const migrations = [
  {
    up: migration_20250929_111647.up,
    down: migration_20250929_111647.down,
    name: '20250929_111647',
  },
  {
    up: migration_20260930_070407_footer_content_json.up,
    down: migration_20260930_070407_footer_content_json.down,
    name: '20260930_070407_footer_content_json',
  },
  {
    up: migration_20260930_071837_testimonial_collection.up,
    down: migration_20260930_071837_testimonial_collection.down,
    name: '20260930_071837_testimonial_collection'
  },
  {
    up: migration_20260930_193000_typed_content_model.up,
    down: migration_20260930_193000_typed_content_model.down,
    name: '20260930_193000_typed_content_model',
  },
  {
    up: migration_20260930_201500_section_mapping_fields.up,
    down: migration_20260930_201500_section_mapping_fields.down,
    name: '20260930_201500_section_mapping_fields',
  },
];
