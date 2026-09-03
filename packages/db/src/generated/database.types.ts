export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string;
          company: string | null;
          country_code: string;
          created_at: string;
          customer_id: string;
          delivery_instructions: string | null;
          first_name: string;
          id: string;
          is_default: boolean;
          label: string | null;
          last_name: string;
          latitude: number | null;
          line1: string;
          line2: string | null;
          location_precision: string | null;
          longitude: number | null;
          phone: string | null;
          postal_code: string | null;
          province: string | null;
          reference: string | null;
          type: Database['public']['Enums']['address_type'];
          updated_at: string;
        };
        Insert: {
          city: string;
          company?: string | null;
          country_code?: string;
          created_at?: string;
          customer_id: string;
          delivery_instructions?: string | null;
          first_name: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          last_name: string;
          latitude?: number | null;
          line1: string;
          line2?: string | null;
          location_precision?: string | null;
          longitude?: number | null;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          reference?: string | null;
          type?: Database['public']['Enums']['address_type'];
          updated_at?: string;
        };
        Update: {
          city?: string;
          company?: string | null;
          country_code?: string;
          created_at?: string;
          customer_id?: string;
          delivery_instructions?: string | null;
          first_name?: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          last_name?: string;
          latitude?: number | null;
          line1?: string;
          line2?: string | null;
          location_precision?: string | null;
          longitude?: number | null;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          reference?: string | null;
          type?: Database['public']['Enums']['address_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'addresses_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_bootstrap: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string;
          note: string | null;
          role: Database['public']['Enums']['user_role'];
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at?: string;
          note?: string | null;
          role: Database['public']['Enums']['user_role'];
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string;
          note?: string | null;
          role?: Database['public']['Enums']['user_role'];
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          changes: Json;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          ip_address: unknown;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          changes?: Json;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: number;
          ip_address?: unknown;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          changes?: Json;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: number;
          ip_address?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      campaigns: {
        Row: {
          body: string | null;
          channel: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          scheduled_at: string | null;
          segment: Json;
          sent_at: string | null;
          stats: Json;
          status: Database['public']['Enums']['content_status'];
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          scheduled_at?: string | null;
          segment?: Json;
          sent_at?: string | null;
          stats?: Json;
          status?: Database['public']['Enums']['content_status'];
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          scheduled_at?: string | null;
          segment?: Json;
          sent_at?: string | null;
          stats?: Json;
          status?: Database['public']['Enums']['content_status'];
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          id: string;
          quantity: number;
          unit_price: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          quantity?: number;
          unit_price: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
          quantity?: number;
          unit_price?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cart_items_cart_id_fkey';
            columns: ['cart_id'];
            isOneToOne: false;
            referencedRelation: 'carts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cart_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['default_variant_id'];
          },
          {
            foreignKeyName: 'cart_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cart_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'report_low_stock';
            referencedColumns: ['variant_id'];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          currency: string;
          customer_id: string | null;
          discount_code: string | null;
          expires_at: string;
          id: string;
          session_token: string | null;
          status: Database['public']['Enums']['cart_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          discount_code?: string | null;
          expires_at?: string;
          id?: string;
          session_token?: string | null;
          status?: Database['public']['Enums']['cart_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          discount_code?: string | null;
          expires_at?: string;
          id?: string;
          session_token?: string | null;
          status?: Database['public']['Enums']['cart_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'carts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          parent_id: string | null;
          position: number;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          parent_id?: string | null;
          position?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          parent_id?: string | null;
          position?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      cms_banners: {
        Row: {
          created_at: string;
          created_by: string | null;
          cta_label: string | null;
          cta_url: string | null;
          ends_at: string | null;
          eyebrow: string | null;
          id: string;
          is_active: boolean;
          media_url: string | null;
          placement: string;
          position: number;
          starts_at: string | null;
          subtitle: string | null;
          theme: Json;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          ends_at?: string | null;
          eyebrow?: string | null;
          id?: string;
          is_active?: boolean;
          media_url?: string | null;
          placement: string;
          position?: number;
          starts_at?: string | null;
          subtitle?: string | null;
          theme?: Json;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          ends_at?: string | null;
          eyebrow?: string | null;
          id?: string;
          is_active?: boolean;
          media_url?: string | null;
          placement?: string;
          position?: number;
          starts_at?: string | null;
          subtitle?: string | null;
          theme?: Json;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cms_banners_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cms_menus: {
        Row: {
          id: string;
          items: Json;
          location: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          items?: Json;
          location: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          items?: Json;
          location?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cms_pages: {
        Row: {
          content: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: Database['public']['Enums']['content_status'];
          title: string;
          updated_at: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: Database['public']['Enums']['content_status'];
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database['public']['Enums']['content_status'];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cms_pages_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cms_posts: {
        Row: {
          author_id: string | null;
          content: Json;
          cover_url: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: Database['public']['Enums']['content_status'];
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          content?: Json;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: Database['public']['Enums']['content_status'];
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          content?: Json;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database['public']['Enums']['content_status'];
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cms_posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      courier_zones: {
        Row: {
          courier_id: string;
          zone_id: string;
        };
        Insert: {
          courier_id: string;
          zone_id: string;
        };
        Update: {
          courier_id?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'courier_zones_courier_id_fkey';
            columns: ['courier_id'];
            isOneToOne: false;
            referencedRelation: 'couriers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'courier_zones_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'delivery_zones';
            referencedColumns: ['id'];
          },
        ];
      };
      couriers: {
        Row: {
          created_at: string;
          display_name: string;
          documents: Json;
          id: string;
          national_id: string | null;
          notes: string | null;
          phone: string | null;
          plate: string | null;
          profile_id: string;
          rate: number | null;
          status: string;
          updated_at: string;
          vehicle_type: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          documents?: Json;
          id?: string;
          national_id?: string | null;
          notes?: string | null;
          phone?: string | null;
          plate?: string | null;
          profile_id: string;
          rate?: number | null;
          status?: string;
          updated_at?: string;
          vehicle_type?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          documents?: Json;
          id?: string;
          national_id?: string | null;
          notes?: string | null;
          phone?: string | null;
          plate?: string | null;
          profile_id?: string;
          rate?: number | null;
          status?: string;
          updated_at?: string;
          vehicle_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'couriers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      crm_notes: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          customer_id: string;
          id: string;
          is_pinned: boolean;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'crm_notes_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'crm_notes_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      crm_tags: {
        Row: {
          color: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          accepts_marketing: boolean;
          created_at: string;
          email: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          last_order_at: string | null;
          marketing_opt_in_at: string | null;
          notes_count: number;
          orders_count: number;
          phone: string | null;
          profile_id: string | null;
          tags: string[];
          total_spent: number;
          updated_at: string;
        };
        Insert: {
          accepts_marketing?: boolean;
          created_at?: string;
          email: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          last_order_at?: string | null;
          marketing_opt_in_at?: string | null;
          notes_count?: number;
          orders_count?: number;
          phone?: string | null;
          profile_id?: string | null;
          tags?: string[];
          total_spent?: number;
          updated_at?: string;
        };
        Update: {
          accepts_marketing?: boolean;
          created_at?: string;
          email?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          last_order_at?: string | null;
          marketing_opt_in_at?: string | null;
          notes_count?: number;
          orders_count?: number;
          phone?: string | null;
          profile_id?: string | null;
          tags?: string[];
          total_spent?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      delivery_zones: {
        Row: {
          created_at: string;
          description: string | null;
          handled_by: string;
          id: string;
          is_active: boolean;
          name: string;
          polygon: Json;
          position: number;
          shipping_price: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          handled_by?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          polygon?: Json;
          position?: number;
          shipping_price?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          handled_by?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          polygon?: Json;
          position?: number;
          shipping_price?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      discount_redemptions: {
        Row: {
          amount: number;
          created_at: string;
          customer_id: string | null;
          discount_id: string;
          id: string;
          order_id: string | null;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          customer_id?: string | null;
          discount_id: string;
          id?: string;
          order_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          customer_id?: string | null;
          discount_id?: string;
          id?: string;
          order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'discount_redemptions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'discount_redemptions_discount_id_fkey';
            columns: ['discount_id'];
            isOneToOne: false;
            referencedRelation: 'discounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'discount_redemptions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      discounts: {
        Row: {
          applies_to: Json;
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          min_subtotal: number;
          starts_at: string;
          type: Database['public']['Enums']['discount_type'];
          updated_at: string;
          usage_count: number;
          usage_limit: number | null;
          usage_limit_per_customer: number | null;
          value: number;
        };
        Insert: {
          applies_to?: Json;
          code: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          min_subtotal?: number;
          starts_at?: string;
          type?: Database['public']['Enums']['discount_type'];
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
          usage_limit_per_customer?: number | null;
          value?: number;
        };
        Update: {
          applies_to?: Json;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          min_subtotal?: number;
          starts_at?: string;
          type?: Database['public']['Enums']['discount_type'];
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
          usage_limit_per_customer?: number | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'discounts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      integration_credentials: {
        Row: {
          actualizado_en: string;
          actualizado_por: string | null;
          clave: string;
          es_secreto: boolean;
          pista: string;
          proveedor: string;
          valor_cifrado: string;
        };
        Insert: {
          actualizado_en?: string;
          actualizado_por?: string | null;
          clave: string;
          es_secreto?: boolean;
          pista: string;
          proveedor: string;
          valor_cifrado: string;
        };
        Update: {
          actualizado_en?: string;
          actualizado_por?: string | null;
          clave?: string;
          es_secreto?: boolean;
          pista?: string;
          proveedor?: string;
          valor_cifrado?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'integration_credentials_actualizado_por_fkey';
            columns: ['actualizado_por'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      integrations: {
        Row: {
          config: Json;
          environment: string;
          is_enabled: boolean;
          last_checked_at: string | null;
          provider: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          config?: Json;
          environment?: string;
          is_enabled?: boolean;
          last_checked_at?: string | null;
          provider: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          config?: Json;
          environment?: string;
          is_enabled?: boolean;
          last_checked_at?: string | null;
          provider?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'integrations_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory: {
        Row: {
          allow_backorder: boolean;
          location: string;
          low_stock_threshold: number;
          quantity: number;
          reserved_quantity: number;
          track_inventory: boolean;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          allow_backorder?: boolean;
          location?: string;
          low_stock_threshold?: number;
          quantity?: number;
          reserved_quantity?: number;
          track_inventory?: boolean;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          allow_backorder?: boolean;
          location?: string;
          low_stock_threshold?: number;
          quantity?: number;
          reserved_quantity?: number;
          track_inventory?: boolean;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: true;
            referencedRelation: 'product_catalog';
            referencedColumns: ['default_variant_id'];
          },
          {
            foreignKeyName: 'inventory_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: true;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: true;
            referencedRelation: 'report_low_stock';
            referencedColumns: ['variant_id'];
          },
        ];
      };
      leads: {
        Row: {
          created_at: string;
          customer_id: string | null;
          email: string;
          id: string;
          name: string | null;
          notes: string | null;
          phone: string | null;
          source: string;
          status: Database['public']['Enums']['lead_status'];
          updated_at: string;
          utm: Json;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          email: string;
          id?: string;
          name?: string | null;
          notes?: string | null;
          phone?: string | null;
          source?: string;
          status?: Database['public']['Enums']['lead_status'];
          updated_at?: string;
          utm?: Json;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          email?: string;
          id?: string;
          name?: string | null;
          notes?: string | null;
          phone?: string | null;
          source?: string;
          status?: Database['public']['Enums']['lead_status'];
          updated_at?: string;
          utm?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      order_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          message: string | null;
          metadata: Json;
          order_id: string;
          type: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          metadata?: Json;
          order_id: string;
          type: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          metadata?: Json;
          order_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          discount_total: number;
          id: string;
          image_url: string | null;
          order_id: string;
          product_id: string | null;
          product_title: string;
          quantity: number;
          sku: string | null;
          total: number;
          unit_price: number;
          variant_id: string | null;
          variant_title: string | null;
        };
        Insert: {
          created_at?: string;
          discount_total?: number;
          id?: string;
          image_url?: string | null;
          order_id: string;
          product_id?: string | null;
          product_title: string;
          quantity: number;
          sku?: string | null;
          total: number;
          unit_price: number;
          variant_id?: string | null;
          variant_title?: string | null;
        };
        Update: {
          created_at?: string;
          discount_total?: number;
          id?: string;
          image_url?: string | null;
          order_id?: string;
          product_id?: string | null;
          product_title?: string;
          quantity?: number;
          sku?: string | null;
          total?: number;
          unit_price?: number;
          variant_id?: string | null;
          variant_title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['default_variant_id'];
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'report_low_stock';
            referencedColumns: ['variant_id'];
          },
        ];
      };
      orders: {
        Row: {
          amount_paid: number;
          balance_due: number | null;
          billing_address: Json | null;
          cancelled_reason: string | null;
          cart_id: string | null;
          confirmation_token: string;
          created_at: string;
          currency: string;
          customer_id: string | null;
          customer_note: string | null;
          discount_code: string | null;
          discount_total: number;
          email: string;
          fulfillment_status: Database['public']['Enums']['fulfillment_status'];
          id: string;
          internal_note: string | null;
          order_number: string;
          payment_status: Database['public']['Enums']['payment_status'];
          phone: string | null;
          placed_at: string | null;
          shipping_address: Json | null;
          shipping_method: Json | null;
          shipping_total: number;
          status: Database['public']['Enums']['order_status'];
          subtotal: number;
          tax_total: number;
          total: number;
          updated_at: string;
        };
        Insert: {
          amount_paid?: number;
          balance_due?: number | null;
          billing_address?: Json | null;
          cancelled_reason?: string | null;
          cart_id?: string | null;
          confirmation_token?: string;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          customer_note?: string | null;
          discount_code?: string | null;
          discount_total?: number;
          email: string;
          fulfillment_status?: Database['public']['Enums']['fulfillment_status'];
          id?: string;
          internal_note?: string | null;
          order_number?: string;
          payment_status?: Database['public']['Enums']['payment_status'];
          phone?: string | null;
          placed_at?: string | null;
          shipping_address?: Json | null;
          shipping_method?: Json | null;
          shipping_total?: number;
          status?: Database['public']['Enums']['order_status'];
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
        };
        Update: {
          amount_paid?: number;
          balance_due?: number | null;
          billing_address?: Json | null;
          cancelled_reason?: string | null;
          cart_id?: string | null;
          confirmation_token?: string;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          customer_note?: string | null;
          discount_code?: string | null;
          discount_total?: number;
          email?: string;
          fulfillment_status?: Database['public']['Enums']['fulfillment_status'];
          id?: string;
          internal_note?: string | null;
          order_number?: string;
          payment_status?: Database['public']['Enums']['payment_status'];
          phone?: string | null;
          placed_at?: string | null;
          shipping_address?: Json | null;
          shipping_method?: Json | null;
          shipping_total?: number;
          status?: Database['public']['Enums']['order_status'];
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_cart_id_fkey';
            columns: ['cart_id'];
            isOneToOne: false;
            referencedRelation: 'carts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_webhook_events: {
        Row: {
          error_message: string | null;
          event_id: string;
          event_type: string | null;
          id: string;
          order_id: string | null;
          payload: Json;
          processed_at: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          received_at: string;
          signature_valid: boolean;
        };
        Insert: {
          error_message?: string | null;
          event_id: string;
          event_type?: string | null;
          id?: string;
          order_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          received_at?: string;
          signature_valid?: boolean;
        };
        Update: {
          error_message?: string | null;
          event_id?: string;
          event_type?: string | null;
          id?: string;
          order_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          provider?: Database['public']['Enums']['payment_provider'];
          received_at?: string;
          signature_valid?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_webhook_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          error_message: string | null;
          id: string;
          order_id: string;
          processed_at: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_payment_id: string | null;
          provider_response: Json;
          receipt_key: string | null;
          reference: string | null;
          status: Database['public']['Enums']['payment_status'];
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          error_message?: string | null;
          id?: string;
          order_id: string;
          processed_at?: string | null;
          provider: Database['public']['Enums']['payment_provider'];
          provider_payment_id?: string | null;
          provider_response?: Json;
          receipt_key?: string | null;
          reference?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          error_message?: string | null;
          id?: string;
          order_id?: string;
          processed_at?: string | null;
          provider?: Database['public']['Enums']['payment_provider'];
          provider_payment_id?: string | null;
          provider_response?: Json;
          receipt_key?: string | null;
          reference?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      product_categories: {
        Row: {
          category_id: string;
          product_id: string;
        };
        Insert: {
          category_id: string;
          product_id: string;
        };
        Update: {
          category_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_categories_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_categories_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_categories_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_images: {
        Row: {
          alt: string | null;
          created_at: string;
          id: string;
          is_primary: boolean;
          position: number;
          product_id: string;
          url: string;
        };
        Insert: {
          alt?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          position?: number;
          product_id: string;
          url: string;
        };
        Update: {
          alt?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          position?: number;
          product_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_options: {
        Row: {
          id: string;
          name: string;
          position: number;
          product_id: string;
          values: string[];
        };
        Insert: {
          id?: string;
          name: string;
          position?: number;
          product_id: string;
          values?: string[];
        };
        Update: {
          id?: string;
          name?: string;
          position?: number;
          product_id?: string;
          values?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'product_options_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_options_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_variants: {
        Row: {
          barcode: string | null;
          compare_at_price: number | null;
          cost_price: number | null;
          created_at: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          is_default: boolean;
          option_values: Json;
          position: number;
          price: number;
          product_id: string;
          sku: string | null;
          title: string;
          updated_at: string;
          weight_grams: number | null;
        };
        Insert: {
          barcode?: string | null;
          compare_at_price?: number | null;
          cost_price?: number | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_default?: boolean;
          option_values?: Json;
          position?: number;
          price: number;
          product_id: string;
          sku?: string | null;
          title?: string;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Update: {
          barcode?: string | null;
          compare_at_price?: number | null;
          cost_price?: number | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_default?: boolean;
          option_values?: Json;
          position?: number;
          price?: number;
          product_id?: string;
          sku?: string | null;
          title?: string;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          brand: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_featured: boolean;
          published_at: string | null;
          rating_average: number;
          rating_count: number;
          search_vector: unknown;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: Database['public']['Enums']['product_status'];
          subtitle: string | null;
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          published_at?: string | null;
          rating_average?: number;
          rating_count?: number;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: Database['public']['Enums']['product_status'];
          subtitle?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          published_at?: string | null;
          rating_average?: number;
          rating_count?: number;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database['public']['Enums']['product_status'];
          subtitle?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          last_seen_at: string | null;
          phone: string | null;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          author_name: string;
          body: string | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          product_id: string;
          rating: number;
          status: Database['public']['Enums']['review_status'];
          title: string | null;
          updated_at: string;
        };
        Insert: {
          author_name: string;
          body?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          product_id: string;
          rating: number;
          status?: Database['public']['Enums']['review_status'];
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          author_name?: string;
          body?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          product_id?: string;
          rating?: number;
          status?: Database['public']['Enums']['review_status'];
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          description: string | null;
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          description?: string | null;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      shipments: {
        Row: {
          assigned_to: string | null;
          carrier: string | null;
          carrier_tracking_number: string | null;
          carrier_tracking_url: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_note: string | null;
          delivery_proof_key: string | null;
          destination: Json;
          dispatched_at: string | null;
          estimated_at: string | null;
          failure_reason: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          order_id: string;
          received_by: string | null;
          shipping_cost: number | null;
          status: string;
          token: string;
          tracking_number: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          carrier?: string | null;
          carrier_tracking_number?: string | null;
          carrier_tracking_url?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_note?: string | null;
          delivery_proof_key?: string | null;
          destination?: Json;
          dispatched_at?: string | null;
          estimated_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          order_id: string;
          received_by?: string | null;
          shipping_cost?: number | null;
          status?: string;
          token?: string;
          tracking_number?: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          carrier?: string | null;
          carrier_tracking_number?: string | null;
          carrier_tracking_url?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_note?: string | null;
          delivery_proof_key?: string | null;
          destination?: Json;
          dispatched_at?: string | null;
          estimated_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          order_id?: string;
          received_by?: string | null;
          shipping_cost?: number | null;
          status?: string;
          token?: string;
          tracking_number?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shipments_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      shipping_methods: {
        Row: {
          countries: string[];
          created_at: string;
          description: string | null;
          estimated_days_max: number | null;
          estimated_days_min: number | null;
          free_above_subtotal: number | null;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
          price: number;
          updated_at: string;
        };
        Insert: {
          countries?: string[];
          created_at?: string;
          description?: string | null;
          estimated_days_max?: number | null;
          estimated_days_min?: number | null;
          free_above_subtotal?: number | null;
          id?: string;
          is_active?: boolean;
          name: string;
          position?: number;
          price?: number;
          updated_at?: string;
        };
        Update: {
          countries?: string[];
          created_at?: string;
          description?: string | null;
          estimated_days_max?: number | null;
          estimated_days_min?: number | null;
          free_above_subtotal?: number | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          position?: number;
          price?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          created_at: string;
          product_id: string;
          wishlist_id: string;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          wishlist_id: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          wishlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_wishlist_id_fkey';
            columns: ['wishlist_id'];
            isOneToOne: false;
            referencedRelation: 'wishlists';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlists: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlists_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      product_catalog: {
        Row: {
          available_quantity: number | null;
          brand: string | null;
          compare_at_price: number | null;
          default_variant_id: string | null;
          discount_percent: number | null;
          id: string | null;
          image_alt: string | null;
          image_url: string | null;
          is_featured: boolean | null;
          on_sale: boolean | null;
          price: number | null;
          published_at: string | null;
          rating_average: number | null;
          rating_count: number | null;
          sku: string | null;
          slug: string | null;
          status: Database['public']['Enums']['product_status'] | null;
          subtitle: string | null;
          tags: string[] | null;
          title: string | null;
          track_inventory: boolean | null;
        };
        Relationships: [];
      };
      report_conversion_funnel: {
        Row: {
          carts_abandoned: number | null;
          carts_converted: number | null;
          carts_created: number | null;
          carts_with_items: number | null;
          day: string | null;
        };
        Relationships: [];
      };
      report_low_stock: {
        Row: {
          available_quantity: number | null;
          low_stock_threshold: number | null;
          product_id: string | null;
          product_title: string | null;
          quantity: number | null;
          reserved_quantity: number | null;
          sku: string | null;
          variant_id: string | null;
          variant_title: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      report_sales_daily: {
        Row: {
          average_order_value: number | null;
          day: string | null;
          discounts: number | null;
          orders_count: number | null;
          revenue: number | null;
          shipping: number | null;
        };
        Relationships: [];
      };
      report_top_products: {
        Row: {
          orders_count: number | null;
          product_id: string | null;
          revenue: number | null;
          slug: string | null;
          title: string | null;
          units_sold: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_catalog';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      build_product_search_vector: {
        Args: {
          p_brand: string;
          p_description: string;
          p_subtitle: string;
          p_tags: string[];
          p_title: string;
        };
        Returns: unknown;
      };
      caducar_reservas_de_pedidos: {
        Args: { p_horas?: number };
        Returns: number;
      };
      create_order: {
        Args: {
          p_customer_note?: string;
          p_discount_code?: string;
          p_email: string;
          p_first_name?: string;
          p_last_name?: string;
          p_lines: Json;
          p_phone?: string;
          p_shipping_address?: Json;
          p_shipping_method_id?: string;
        };
        Returns: {
          confirmation_token: string;
          discount_total: number;
          order_id: string;
          order_number: string;
          shipping_total: number;
          subtotal: number;
          total: number;
        }[];
      };
      current_courier_id: { Args: never; Returns: string };
      current_customer_id: { Args: never; Returns: string };
      current_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      dashboard_metrics: {
        Args: { p_days?: number };
        Returns: {
          average_order_value: number;
          low_stock_items: number;
          new_customers: number;
          orders_count: number;
          pending_orders: number;
          revenue: number;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
      is_courier: { Args: never; Returns: boolean };
      is_staff: { Args: never; Returns: boolean };
      is_superadmin: { Args: never; Returns: boolean };
      record_audit: {
        Args: {
          p_action: string;
          p_changes?: Json;
          p_entity: string;
          p_entity_id?: string;
        };
        Returns: undefined;
      };
      search_products: {
        Args: { p_limit?: number; p_offset?: number; p_query: string };
        Returns: {
          available_quantity: number | null;
          brand: string | null;
          compare_at_price: number | null;
          default_variant_id: string | null;
          discount_percent: number | null;
          id: string | null;
          image_alt: string | null;
          image_url: string | null;
          is_featured: boolean | null;
          on_sale: boolean | null;
          price: number | null;
          published_at: string | null;
          rating_average: number | null;
          rating_count: number | null;
          sku: string | null;
          slug: string | null;
          status: Database['public']['Enums']['product_status'] | null;
          subtitle: string | null;
          tags: string[] | null;
          title: string | null;
          track_inventory: boolean | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'product_catalog';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      slugify: { Args: { value: string }; Returns: string };
      validate_discount: {
        Args: { p_code: string; p_customer_id?: string; p_subtotal: number };
        Returns: {
          amount: number;
          code: string;
          discount_id: string;
          is_valid: boolean;
          reason: string;
          type: Database['public']['Enums']['discount_type'];
        }[];
      };
    };
    Enums: {
      address_type: 'shipping' | 'billing';
      cart_status: 'active' | 'converted' | 'abandoned';
      content_status: 'draft' | 'published' | 'archived';
      discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
      fulfillment_status: 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';
      lead_status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
      order_status:
        'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
      payment_provider: 'paypal' | 'wompi' | 'paguelofacil' | 'yappy' | 'manual';
      payment_status:
        | 'pending'
        | 'authorized'
        | 'partially_paid'
        | 'paid'
        | 'partially_refunded'
        | 'refunded'
        | 'failed'
        | 'cancelled';
      product_status: 'draft' | 'active' | 'archived';
      review_status: 'pending' | 'approved' | 'rejected';
      user_role: 'customer' | 'operator' | 'admin' | 'superadmin' | 'courier';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      address_type: ['shipping', 'billing'],
      cart_status: ['active', 'converted', 'abandoned'],
      content_status: ['draft', 'published', 'archived'],
      discount_type: ['percentage', 'fixed_amount', 'free_shipping'],
      fulfillment_status: ['unfulfilled', 'partial', 'fulfilled', 'returned'],
      lead_status: ['new', 'contacted', 'qualified', 'converted', 'lost'],
      order_status: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
      ],
      payment_provider: ['paypal', 'wompi', 'paguelofacil', 'yappy', 'manual'],
      payment_status: [
        'pending',
        'authorized',
        'partially_paid',
        'paid',
        'partially_refunded',
        'refunded',
        'failed',
        'cancelled',
      ],
      product_status: ['draft', 'active', 'archived'],
      review_status: ['pending', 'approved', 'rejected'],
      user_role: ['customer', 'operator', 'admin', 'superadmin', 'courier'],
    },
  },
} as const;
