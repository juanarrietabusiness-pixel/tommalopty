/**
 * Tipos de la base de datos — reflejo del esquema de `supabase/migrations`.
 *
 * NO EDITAR A MANO. Regenerar con:
 *   pnpm db:types      (supabase gen types typescript --local)
 *
 * Este archivo se generó por introspección del esquema aplicado, con el mismo
 * formato que produce la CLI de Supabase.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      addresses: {
        Row: {
          id: string;
          customer_id: string;
          type: Database['public']['Enums']['address_type'];
          label: string | null;
          first_name: string;
          last_name: string;
          company: string | null;
          line1: string;
          line2: string | null;
          city: string;
          province: string | null;
          country_code: string;
          postal_code: string | null;
          phone: string | null;
          latitude: number | null;
          longitude: number | null;
          location_precision: string | null;
          reference: string | null;
          delivery_instructions: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          type?: Database['public']['Enums']['address_type'];
          label?: string | null;
          first_name: string;
          last_name: string;
          company?: string | null;
          line1: string;
          line2?: string | null;
          city: string;
          province?: string | null;
          country_code?: string;
          postal_code?: string | null;
          phone?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_precision?: string | null;
          reference?: string | null;
          delivery_instructions?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          type?: Database['public']['Enums']['address_type'];
          label?: string | null;
          first_name?: string;
          last_name?: string;
          company?: string | null;
          line1?: string;
          line2?: string | null;
          city?: string;
          province?: string | null;
          country_code?: string;
          postal_code?: string | null;
          phone?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_precision?: string | null;
          reference?: string | null;
          delivery_instructions?: string | null;
          is_default?: boolean;
          created_at?: string;
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
          email: string;
          role: Database['public']['Enums']['user_role'];
          note: string | null;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          email: string;
          role: Database['public']['Enums']['user_role'];
          note?: string | null;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          email?: string;
          role?: Database['public']['Enums']['user_role'];
          note?: string | null;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          changes: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          changes?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          changes?: Json;
          ip_address?: string | null;
          created_at?: string;
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
          id: string;
          name: string;
          channel: string;
          status: Database['public']['Enums']['content_status'];
          subject: string | null;
          body: string | null;
          segment: Json;
          scheduled_at: string | null;
          sent_at: string | null;
          stats: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          channel?: string;
          status?: Database['public']['Enums']['content_status'];
          subject?: string | null;
          body?: string | null;
          segment?: Json;
          scheduled_at?: string | null;
          sent_at?: string | null;
          stats?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          channel?: string;
          status?: Database['public']['Enums']['content_status'];
          subject?: string | null;
          body?: string | null;
          segment?: Json;
          scheduled_at?: string | null;
          sent_at?: string | null;
          stats?: Json;
          created_by?: string | null;
          created_at?: string;
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
          id: string;
          cart_id: string;
          variant_id: string;
          quantity: number;
          unit_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          variant_id: string;
          quantity?: number;
          unit_price: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          variant_id?: string;
          quantity?: number;
          unit_price?: number;
          created_at?: string;
          updated_at?: string;
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
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      carts: {
        Row: {
          id: string;
          customer_id: string | null;
          session_token: string | null;
          status: Database['public']['Enums']['cart_status'];
          currency: string;
          discount_code: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          session_token?: string | null;
          status?: Database['public']['Enums']['cart_status'];
          currency?: string;
          discount_code?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          session_token?: string | null;
          status?: Database['public']['Enums']['cart_status'];
          currency?: string;
          discount_code?: string | null;
          expires_at?: string;
          created_at?: string;
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
          id: string;
          parent_id: string | null;
          slug: string;
          name: string;
          description: string | null;
          image_url: string | null;
          position: number;
          is_active: boolean;
          seo_title: string | null;
          seo_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id?: string | null;
          slug: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          position?: number;
          is_active?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string | null;
          slug?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          position?: number;
          is_active?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
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
          id: string;
          placement: string;
          eyebrow: string | null;
          title: string | null;
          subtitle: string | null;
          cta_label: string | null;
          cta_url: string | null;
          media_url: string | null;
          theme: Json;
          position: number;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          placement: string;
          eyebrow?: string | null;
          title?: string | null;
          subtitle?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          media_url?: string | null;
          theme?: Json;
          position?: number;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          placement?: string;
          eyebrow?: string | null;
          title?: string | null;
          subtitle?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          media_url?: string | null;
          theme?: Json;
          position?: number;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
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
          location: string;
          items: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location: string;
          items?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location?: string;
          items?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      cms_pages: {
        Row: {
          id: string;
          slug: string;
          title: string;
          status: Database['public']['Enums']['content_status'];
          content: Json;
          seo_title: string | null;
          seo_description: string | null;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          status?: Database['public']['Enums']['content_status'];
          content?: Json;
          seo_title?: string | null;
          seo_description?: string | null;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          status?: Database['public']['Enums']['content_status'];
          content?: Json;
          seo_title?: string | null;
          seo_description?: string | null;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
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
          id: string;
          slug: string;
          title: string;
          excerpt: string | null;
          content: Json;
          cover_url: string | null;
          tags: string[];
          status: Database['public']['Enums']['content_status'];
          seo_title: string | null;
          seo_description: string | null;
          author_id: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          excerpt?: string | null;
          content?: Json;
          cover_url?: string | null;
          tags?: string[];
          status?: Database['public']['Enums']['content_status'];
          seo_title?: string | null;
          seo_description?: string | null;
          author_id?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          excerpt?: string | null;
          content?: Json;
          cover_url?: string | null;
          tags?: string[];
          status?: Database['public']['Enums']['content_status'];
          seo_title?: string | null;
          seo_description?: string | null;
          author_id?: string | null;
          published_at?: string | null;
          created_at?: string;
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
      crm_notes: {
        Row: {
          id: string;
          customer_id: string;
          author_id: string | null;
          body: string;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          author_id?: string | null;
          body: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          author_id?: string | null;
          body?: string;
          is_pinned?: boolean;
          created_at?: string;
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
          id: string;
          name: string;
          color: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          profile_id: string | null;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          accepts_marketing: boolean;
          marketing_opt_in_at: string | null;
          tags: string[];
          orders_count: number;
          total_spent: number;
          last_order_at: string | null;
          notes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          accepts_marketing?: boolean;
          marketing_opt_in_at?: string | null;
          tags?: string[];
          orders_count?: number;
          total_spent?: number;
          last_order_at?: string | null;
          notes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          accepts_marketing?: boolean;
          marketing_opt_in_at?: string | null;
          tags?: string[];
          orders_count?: number;
          total_spent?: number;
          last_order_at?: string | null;
          notes_count?: number;
          created_at?: string;
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
          id: string;
          name: string;
          description: string | null;
          polygon: Json;
          shipping_price: number | null;
          handled_by: string;
          is_active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          polygon?: Json;
          shipping_price?: number | null;
          handled_by?: string;
          is_active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          polygon?: Json;
          shipping_price?: number | null;
          handled_by?: string;
          is_active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      discount_redemptions: {
        Row: {
          id: string;
          discount_id: string;
          customer_id: string | null;
          order_id: string | null;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          discount_id: string;
          customer_id?: string | null;
          order_id?: string | null;
          amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          discount_id?: string;
          customer_id?: string | null;
          order_id?: string | null;
          amount?: number;
          created_at?: string;
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
          id: string;
          code: string;
          description: string | null;
          type: Database['public']['Enums']['discount_type'];
          value: number;
          min_subtotal: number;
          applies_to: Json;
          usage_limit: number | null;
          usage_limit_per_customer: number | null;
          usage_count: number;
          starts_at: string;
          ends_at: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          type?: Database['public']['Enums']['discount_type'];
          value?: number;
          min_subtotal?: number;
          applies_to?: Json;
          usage_limit?: number | null;
          usage_limit_per_customer?: number | null;
          usage_count?: number;
          starts_at?: string;
          ends_at?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          type?: Database['public']['Enums']['discount_type'];
          value?: number;
          min_subtotal?: number;
          applies_to?: Json;
          usage_limit?: number | null;
          usage_limit_per_customer?: number | null;
          usage_count?: number;
          starts_at?: string;
          ends_at?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
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
      integrations: {
        Row: {
          provider: string;
          is_enabled: boolean;
          environment: string;
          config: Json;
          last_checked_at: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          provider: string;
          is_enabled?: boolean;
          environment?: string;
          config?: Json;
          last_checked_at?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          provider?: string;
          is_enabled?: boolean;
          environment?: string;
          config?: Json;
          last_checked_at?: string | null;
          updated_by?: string | null;
          updated_at?: string;
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
          variant_id: string;
          quantity: number;
          reserved_quantity: number;
          low_stock_threshold: number;
          track_inventory: boolean;
          allow_backorder: boolean;
          location: string;
          updated_at: string;
        };
        Insert: {
          variant_id: string;
          quantity?: number;
          reserved_quantity?: number;
          low_stock_threshold?: number;
          track_inventory?: boolean;
          allow_backorder?: boolean;
          location?: string;
          updated_at?: string;
        };
        Update: {
          variant_id?: string;
          quantity?: number;
          reserved_quantity?: number;
          low_stock_threshold?: number;
          track_inventory?: boolean;
          allow_backorder?: boolean;
          location?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: true;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      leads: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          phone: string | null;
          source: string;
          status: Database['public']['Enums']['lead_status'];
          utm: Json;
          customer_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          phone?: string | null;
          source?: string;
          status?: Database['public']['Enums']['lead_status'];
          utm?: Json;
          customer_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          phone?: string | null;
          source?: string;
          status?: Database['public']['Enums']['lead_status'];
          utm?: Json;
          customer_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
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
          id: string;
          order_id: string;
          actor_id: string | null;
          type: string;
          message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          actor_id?: string | null;
          type: string;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          actor_id?: string | null;
          type?: string;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
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
          id: string;
          order_id: string;
          variant_id: string | null;
          product_id: string | null;
          product_title: string;
          variant_title: string | null;
          sku: string | null;
          image_url: string | null;
          unit_price: number;
          quantity: number;
          discount_total: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          variant_id?: string | null;
          product_id?: string | null;
          product_title: string;
          variant_title?: string | null;
          sku?: string | null;
          image_url?: string | null;
          unit_price: number;
          quantity: number;
          discount_total?: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          variant_id?: string | null;
          product_id?: string | null;
          product_title?: string;
          variant_title?: string | null;
          sku?: string | null;
          image_url?: string | null;
          unit_price?: number;
          quantity?: number;
          discount_total?: number;
          total?: number;
          created_at?: string;
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
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string | null;
          email: string;
          phone: string | null;
          status: Database['public']['Enums']['order_status'];
          payment_status: Database['public']['Enums']['payment_status'];
          fulfillment_status: Database['public']['Enums']['fulfillment_status'];
          currency: string;
          subtotal: number;
          discount_total: number;
          shipping_total: number;
          tax_total: number;
          total: number;
          discount_code: string | null;
          amount_paid: number;
          /** Columna generada: la base la calcula, no se escribe. */
          balance_due: number | null;
          shipping_address: Json | null;
          billing_address: Json | null;
          shipping_method: Json | null;
          customer_note: string | null;
          internal_note: string | null;
          cancelled_reason: string | null;
          cart_id: string | null;
          placed_at: string | null;
          created_at: string;
          updated_at: string;
          confirmation_token: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          customer_id?: string | null;
          email: string;
          phone?: string | null;
          status?: Database['public']['Enums']['order_status'];
          payment_status?: Database['public']['Enums']['payment_status'];
          fulfillment_status?: Database['public']['Enums']['fulfillment_status'];
          currency?: string;
          subtotal?: number;
          discount_total?: number;
          shipping_total?: number;
          tax_total?: number;
          total?: number;
          discount_code?: string | null;
          amount_paid?: number;
          shipping_address?: Json | null;
          billing_address?: Json | null;
          shipping_method?: Json | null;
          customer_note?: string | null;
          internal_note?: string | null;
          cancelled_reason?: string | null;
          cart_id?: string | null;
          placed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          confirmation_token?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string | null;
          email?: string;
          phone?: string | null;
          status?: Database['public']['Enums']['order_status'];
          payment_status?: Database['public']['Enums']['payment_status'];
          fulfillment_status?: Database['public']['Enums']['fulfillment_status'];
          currency?: string;
          subtotal?: number;
          discount_total?: number;
          shipping_total?: number;
          tax_total?: number;
          total?: number;
          discount_code?: string | null;
          amount_paid?: number;
          shipping_address?: Json | null;
          billing_address?: Json | null;
          shipping_method?: Json | null;
          customer_note?: string | null;
          internal_note?: string | null;
          cancelled_reason?: string | null;
          cart_id?: string | null;
          placed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          confirmation_token?: string;
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
          id: string;
          provider: Database['public']['Enums']['payment_provider'];
          event_id: string;
          event_type: string | null;
          signature_valid: boolean;
          payload: Json;
          order_id: string | null;
          processed_at: string | null;
          error_message: string | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          provider: Database['public']['Enums']['payment_provider'];
          event_id: string;
          event_type?: string | null;
          signature_valid?: boolean;
          payload?: Json;
          order_id?: string | null;
          processed_at?: string | null;
          error_message?: string | null;
          received_at?: string;
        };
        Update: {
          id?: string;
          provider?: Database['public']['Enums']['payment_provider'];
          event_id?: string;
          event_type?: string | null;
          signature_valid?: boolean;
          payload?: Json;
          order_id?: string | null;
          processed_at?: string | null;
          error_message?: string | null;
          received_at?: string;
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
          id: string;
          order_id: string;
          provider: Database['public']['Enums']['payment_provider'];
          provider_payment_id: string | null;
          status: Database['public']['Enums']['payment_status'];
          amount: number;
          currency: string;
          provider_response: Json;
          error_message: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider: Database['public']['Enums']['payment_provider'];
          provider_payment_id?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          amount: number;
          currency?: string;
          provider_response?: Json;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          provider?: Database['public']['Enums']['payment_provider'];
          provider_payment_id?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          amount?: number;
          currency?: string;
          provider_response?: Json;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
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
          product_id: string;
          category_id: string;
        };
        Insert: {
          product_id: string;
          category_id: string;
        };
        Update: {
          product_id?: string;
          category_id?: string;
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
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt: string | null;
          position: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt?: string | null;
          position?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt?: string | null;
          position?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
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
          product_id: string;
          name: string;
          values: string[];
          position: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          values?: string[];
          position?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          values?: string[];
          position?: number;
        };
        Relationships: [
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
          id: string;
          product_id: string;
          sku: string | null;
          barcode: string | null;
          title: string;
          price: number;
          compare_at_price: number | null;
          cost_price: number | null;
          weight_grams: number | null;
          option_values: Json;
          image_url: string | null;
          position: number;
          is_default: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku?: string | null;
          barcode?: string | null;
          title?: string;
          price: number;
          compare_at_price?: number | null;
          cost_price?: number | null;
          weight_grams?: number | null;
          option_values?: Json;
          image_url?: string | null;
          position?: number;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string | null;
          barcode?: string | null;
          title?: string;
          price?: number;
          compare_at_price?: number | null;
          cost_price?: number | null;
          weight_grams?: number | null;
          option_values?: Json;
          image_url?: string | null;
          position?: number;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
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
          id: string;
          slug: string;
          title: string;
          subtitle: string | null;
          description: string | null;
          brand: string | null;
          status: Database['public']['Enums']['product_status'];
          is_featured: boolean;
          tags: string[];
          seo_title: string | null;
          seo_description: string | null;
          rating_average: number;
          rating_count: number;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          search_vector: unknown | null;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          description?: string | null;
          brand?: string | null;
          status?: Database['public']['Enums']['product_status'];
          is_featured?: boolean;
          tags?: string[];
          seo_title?: string | null;
          seo_description?: string | null;
          rating_average?: number;
          rating_count?: number;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          subtitle?: string | null;
          description?: string | null;
          brand?: string | null;
          status?: Database['public']['Enums']['product_status'];
          is_featured?: boolean;
          tags?: string[];
          seo_title?: string | null;
          seo_description?: string | null;
          rating_average?: number;
          rating_count?: number;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
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
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: Database['public']['Enums']['user_role'];
          is_active: boolean;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: Database['public']['Enums']['user_role'];
          is_active?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: Database['public']['Enums']['user_role'];
          is_active?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          customer_id: string | null;
          author_name: string;
          rating: number;
          title: string | null;
          body: string | null;
          status: Database['public']['Enums']['review_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          customer_id?: string | null;
          author_name: string;
          rating: number;
          title?: string | null;
          body?: string | null;
          status?: Database['public']['Enums']['review_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          customer_id?: string | null;
          author_name?: string;
          rating?: number;
          title?: string | null;
          body?: string | null;
          status?: Database['public']['Enums']['review_status'];
          created_at?: string;
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
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          is_public: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
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
          id: string;
          order_id: string;
          tracking_number: string;
          token: string;
          status: string;
          assigned_to: string | null;
          carrier: string | null;
          carrier_tracking_number: string | null;
          carrier_tracking_url: string | null;
          destination: Json;
          latitude: number | null;
          longitude: number | null;
          delivery_proof_key: string | null;
          delivery_note: string | null;
          received_by: string | null;
          failure_reason: string | null;
          shipping_cost: number | null;
          estimated_at: string | null;
          dispatched_at: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          tracking_number?: string;
          token?: string;
          status?: string;
          assigned_to?: string | null;
          carrier?: string | null;
          carrier_tracking_number?: string | null;
          carrier_tracking_url?: string | null;
          destination?: Json;
          latitude?: number | null;
          longitude?: number | null;
          delivery_proof_key?: string | null;
          delivery_note?: string | null;
          received_by?: string | null;
          failure_reason?: string | null;
          shipping_cost?: number | null;
          estimated_at?: string | null;
          dispatched_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          tracking_number?: string;
          token?: string;
          status?: string;
          assigned_to?: string | null;
          carrier?: string | null;
          carrier_tracking_number?: string | null;
          carrier_tracking_url?: string | null;
          destination?: Json;
          latitude?: number | null;
          longitude?: number | null;
          delivery_proof_key?: string | null;
          delivery_note?: string | null;
          received_by?: string | null;
          failure_reason?: string | null;
          shipping_cost?: number | null;
          estimated_at?: string | null;
          dispatched_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shipments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipments_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      shipping_methods: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          free_above_subtotal: number | null;
          estimated_days_min: number | null;
          estimated_days_max: number | null;
          countries: string[];
          is_active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price?: number;
          free_above_subtotal?: number | null;
          estimated_days_min?: number | null;
          estimated_days_max?: number | null;
          countries?: string[];
          is_active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          free_above_subtotal?: number | null;
          estimated_days_min?: number | null;
          estimated_days_max?: number | null;
          countries?: string[];
          is_active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          wishlist_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          wishlist_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          wishlist_id?: string;
          product_id?: string;
          created_at?: string;
        };
        Relationships: [
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
          id: string;
          customer_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          name?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          name?: string;
          created_at?: string;
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
          id: string | null;
          slug: string | null;
          title: string | null;
          subtitle: string | null;
          brand: string | null;
          status: Database['public']['Enums']['product_status'] | null;
          is_featured: boolean | null;
          tags: string[] | null;
          rating_average: number | null;
          rating_count: number | null;
          published_at: string | null;
          default_variant_id: string | null;
          sku: string | null;
          price: number | null;
          compare_at_price: number | null;
          image_url: string | null;
          image_alt: string | null;
          on_sale: boolean | null;
          discount_percent: number | null;
          available_quantity: number | null;
          track_inventory: boolean | null;
        };
        Relationships: [];
      };
      report_conversion_funnel: {
        Row: {
          day: string | null;
          carts_created: number | null;
          carts_with_items: number | null;
          carts_converted: number | null;
          carts_abandoned: number | null;
        };
        Relationships: [];
      };
      report_low_stock: {
        Row: {
          variant_id: string | null;
          product_id: string | null;
          product_title: string | null;
          variant_title: string | null;
          sku: string | null;
          quantity: number | null;
          reserved_quantity: number | null;
          low_stock_threshold: number | null;
          available_quantity: number | null;
        };
        Relationships: [];
      };
      report_sales_daily: {
        Row: {
          day: string | null;
          orders_count: number | null;
          revenue: number | null;
          discounts: number | null;
          shipping: number | null;
          average_order_value: number | null;
        };
        Relationships: [];
      };
      report_top_products: {
        Row: {
          product_id: string | null;
          title: string | null;
          slug: string | null;
          units_sold: number | null;
          revenue: number | null;
          orders_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      search_products: {
        Args: { p_query: string; p_limit?: number; p_offset?: number };
        Returns: Database['public']['Views']['product_catalog']['Row'][];
      };
      validate_discount: {
        Args: { p_code: string; p_subtotal: number; p_customer_id?: string | null };
        Returns: {
          discount_id: string | null;
          code: string;
          type: Database['public']['Enums']['discount_type'] | null;
          amount: number;
          is_valid: boolean;
          reason: string | null;
        }[];
      };
      dashboard_metrics: {
        Args: { p_days?: number };
        Returns: {
          revenue: number;
          orders_count: number;
          average_order_value: number;
          new_customers: number;
          pending_orders: number;
          low_stock_items: number;
        }[];
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_superadmin: { Args: Record<string, never>; Returns: boolean };
      current_customer_id: { Args: Record<string, never>; Returns: string | null };
      create_order: {
        Args: {
          p_email: string;
          p_lines: Json;
          p_shipping_address?: Json | null;
          p_shipping_method_id?: string | null;
          p_discount_code?: string | null;
          p_phone?: string | null;
          p_customer_note?: string | null;
          p_first_name?: string | null;
          p_last_name?: string | null;
        };
        Returns: {
          order_id: string;
          order_number: string;
          confirmation_token: string;
          subtotal: number;
          discount_total: number;
          shipping_total: number;
          total: number;
        }[];
      };
      record_audit: {
        Args: {
          p_action: string;
          p_entity: string;
          p_entity_id?: string | null;
          p_changes?: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      address_type: 'shipping' | 'billing';
      cart_status: 'active' | 'converted' | 'abandoned';
      content_status: 'draft' | 'published' | 'archived';
      discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
      fulfillment_status: 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';
      lead_status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
      order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
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
      user_role: 'customer' | 'operator' | 'admin' | 'superadmin';
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
