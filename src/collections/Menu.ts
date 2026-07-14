import type { CollectionConfig, Field } from 'payload'

const linkProperties: Field[] = [
  { name: 'label', type: 'text', required: true, label: 'Menu Item Title' },
  { name: 'urlOrAnchor', type: 'text', required: true, label: 'Slug or #Anchor Link' },
]

export const Menu: CollectionConfig = {
  slug: 'menus',
  admin: {
    useAsTitle: 'menuName',
    group: 'Navigation & Layout',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: 'menuName',
      type: 'text',
      required: true,
      label: 'Menu Identifier (e.g., Blog Sidebar Menu)',
    },
    {
      name: 'level1',
      type: 'array',
      label: 'Level 1: Root Items',
      fields: [
        ...linkProperties,
        {
          name: 'level2',
          type: 'array',
          label: 'Level 2: Nested Items',
          fields: [
            ...linkProperties,
            {
              name: 'level3',
              type: 'array',
              label: 'Level 3: Deep Nested Items',
              fields: [
                ...linkProperties,
                {
                  name: 'level4',
                  type: 'array',
                  label: 'Level 4: Category Nodes',
                  fields: [
                    ...linkProperties,
                    {
                      name: 'level5',
                      type: 'array',
                      label: 'Level 5: Leaf Nodes',
                      fields: linkProperties,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
