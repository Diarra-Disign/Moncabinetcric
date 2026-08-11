export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      firms: {
        Row: {
          id: string
          name: string
          rcic_license_number: string | null
          owner_name: string | null
          address: string | null
          phone: string | null
          email: string | null
          reply_to_email: string | null
          email_sender_name: string | null
          tax_gst_number: string | null
          tax_qst_number: string | null
          tax_gst_rate: number | null
          tax_qst_rate: number | null
          invoice_prefix: string | null
          payment_terms: string | null
          logo_letter: string | null
          logo_url: string | null
          plan: string
          status: string
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          rcic_license_number?: string | null
          owner_name?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          reply_to_email?: string | null
          email_sender_name?: string | null
          tax_gst_number?: string | null
          tax_qst_number?: string | null
          tax_gst_rate?: number | null
          tax_qst_rate?: number | null
          invoice_prefix?: string | null
          payment_terms?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          rcic_license_number?: string | null
          owner_name?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          reply_to_email?: string | null
          email_sender_name?: string | null
          tax_gst_number?: string | null
          tax_qst_number?: string | null
          tax_gst_rate?: number | null
          tax_qst_rate?: number | null
          invoice_prefix?: string | null
          payment_terms?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          firm_id: string
          full_name: string
          email: string
          cicc_role: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          firm_id: string
          full_name: string
          email: string
          cicc_role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          firm_id?: string
          full_name?: string
          email?: string
          cicc_role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      matters: {
        Row: {
          id: string
          firm_id: string
          client_id: string
          title: string
          file_number: string
          program: string
          status: string
          assignee_id: string | null
          deadline_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          firm_id: string
          client_id: string
          title: string
          file_number: string
          program: string
          status?: string
          assignee_id?: string | null
          deadline_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          firm_id?: string
          client_id?: string
          title?: string
          file_number?: string
          program?: string
          status?: string
          assignee_id?: string | null
          deadline_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          firm_id: string
          name: string
          email: string | null
          phone: string | null
          file_number: string
          program: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          firm_id: string
          name: string
          email?: string | null
          phone?: string | null
          file_number: string
          program: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          firm_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          file_number?: string
          program?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          firm_id: string
          client_id: string
          invoice_number: string
          amount: number
          status: string
          issued_at: string | null
          due_at: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          firm_id: string
          client_id: string
          invoice_number: string
          amount: number
          status?: string
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          firm_id?: string
          client_id?: string
          invoice_number?: string
          amount?: number
          status?: string
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          firm_id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          firm_id: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          firm_id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string
          details?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_firm_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_cicc_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
