
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "attempt_questions": {
                  Row: {
                    "attempt_id": string,"exam_question_id": string,"id": string,"option_order": (string)[],"points": number,"position": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"exam_question_id": string,"id"?: string,"option_order"?: (string)[],"points": number,"position": number,"workspace_id": string
                  }
                  Update: {
                    "attempt_id"?: string,"exam_question_id"?: string,"id"?: string,"option_order"?: (string)[],"points"?: number,"position"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempt_questions_exam_question_id_fkey"
      columns: ["exam_question_id"]
isOneToOne: false
      referencedRelation: "exam_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempt_questions_workspace_id_attempt_id_fkey"
      columns: ["workspace_id","attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"attempt_releases": {
                  Row: {
                    "assignment_id": string,"consumed_at": string | null,"extra_minutes": number,"granted_at": string,"granted_by": string | null,"id": string,"kind": Database["public"]['Enums']["release_kind"],"reason": string | null,"student_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"consumed_at"?: string | null,"extra_minutes"?: number,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["release_kind"],"reason"?: string | null,"student_id": string,"workspace_id": string
                  }
                  Update: {
                    "assignment_id"?: string,"consumed_at"?: string | null,"extra_minutes"?: number,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["release_kind"],"reason"?: string | null,"student_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempt_releases_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "exam_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempt_releases_workspace_id_student_id_fkey"
      columns: ["workspace_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"class_students": {
                  Row: {
                    "class_id": string,"created_at": string,"joined_via": string,"student_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"joined_via"?: string,"student_id": string,"workspace_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"joined_via"?: string,"student_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_students_workspace_id_class_id_fkey"
      columns: ["workspace_id","class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "class_students_workspace_id_student_id_fkey"
      columns: ["workspace_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"class_subjects": {
                  Row: {
                    "class_id": string,"created_at": string,"subject_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"subject_id": string,"workspace_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"subject_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_subjects_workspace_id_class_id_fkey"
      columns: ["workspace_id","class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "class_subjects_workspace_id_subject_id_fkey"
      columns: ["workspace_id","subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"school_year": number | null,"self_enroll": boolean,"teacher_id": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"school_year"?: number | null,"self_enroll"?: boolean,"teacher_id"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"school_year"?: number | null,"self_enroll"?: boolean,"teacher_id"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_assignments": {
                  Row: {
                    "access_code": string | null,"class_id": string,"closed_at": string | null,"closes_at": string,"created_at": string,"exam_id": string,"id": string,"opens_at": string,"public_code": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_code"?: string | null,"class_id": string,"closed_at"?: string | null,"closes_at": string,"created_at"?: string,"exam_id": string,"id"?: string,"opens_at": string,"public_code"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "access_code"?: string | null,"class_id"?: string,"closed_at"?: string | null,"closes_at"?: string,"created_at"?: string,"exam_id"?: string,"id"?: string,"opens_at"?: string,"public_code"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_assignments_workspace_id_class_id_fkey"
      columns: ["workspace_id","class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "exam_assignments_workspace_id_exam_id_fkey"
      columns: ["workspace_id","exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"exam_attempts": {
                  Row: {
                    "assignment_id": string,"attempt_number": number,"auto_score": number | null,"class_id": string,"created_at": string,"exam_id": string,"expires_at": string,"final_score": number | null,"finalize_reason": string | null,"finalized_at": string | null,"grading_status": Database["public"]['Enums']["grading_status"] | null,"id": string,"max_score": number | null,"started_at": string,"status": Database["public"]['Enums']["attempt_status"],"student_id": string,"submitted_at": string | null,"token_hash": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"attempt_number"?: number,"auto_score"?: number | null,"class_id": string,"created_at"?: string,"exam_id": string,"expires_at": string,"final_score"?: number | null,"finalize_reason"?: string | null,"finalized_at"?: string | null,"grading_status"?: Database["public"]['Enums']["grading_status"] | null,"id"?: string,"max_score"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"],"student_id": string,"submitted_at"?: string | null,"token_hash": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "assignment_id"?: string,"attempt_number"?: number,"auto_score"?: number | null,"class_id"?: string,"created_at"?: string,"exam_id"?: string,"expires_at"?: string,"final_score"?: number | null,"finalize_reason"?: string | null,"finalized_at"?: string | null,"grading_status"?: Database["public"]['Enums']["grading_status"] | null,"id"?: string,"max_score"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"],"student_id"?: string,"submitted_at"?: string | null,"token_hash"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_attempts_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "exam_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_attempts_workspace_id_student_id_fkey"
      columns: ["workspace_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"exam_events": {
                  Row: {
                    "actor": string,"assignment_id": string,"attempt_id": string | null,"created_at": string,"id": number,"payload": NonNullable<Json>,"student_id": string | null,"type": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": string,"assignment_id": string,"attempt_id"?: string | null,"created_at"?: string,"id"?: never,"payload"?: NonNullable<Json>,"student_id"?: string | null,"type": string,"workspace_id": string
                  }
                  Update: {
                    "actor"?: string,"assignment_id"?: string,"attempt_id"?: string | null,"created_at"?: string,"id"?: never,"payload"?: NonNullable<Json>,"student_id"?: string | null,"type"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_events_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "exam_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_events_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_questions": {
                  Row: {
                    "answer_key": Json | null,"content": Json | null,"created_at": string,"exam_id": string,"id": string,"points": number,"position": number,"question_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_key"?: Json | null,"content"?: Json | null,"created_at"?: string,"exam_id": string,"id"?: string,"points": number,"position": number,"question_id": string,"workspace_id": string
                  }
                  Update: {
                    "answer_key"?: Json | null,"content"?: Json | null,"created_at"?: string,"exam_id"?: string,"id"?: string,"points"?: number,"position"?: number,"question_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_questions_workspace_id_exam_id_fkey"
      columns: ["workspace_id","exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "exam_questions_workspace_id_question_id_fkey"
      columns: ["workspace_id","question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"exams": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"instructions": string | null,"owner_id": string | null,"published_at": string | null,"questions_per_attempt": number | null,"result_visibility": Database["public"]['Enums']["result_visibility"],"shuffle_options": boolean,"shuffle_questions": boolean,"status": Database["public"]['Enums']["exam_status"],"subject_id": string | null,"time_limit_minutes": number | null,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"instructions"?: string | null,"owner_id"?: string | null,"published_at"?: string | null,"questions_per_attempt"?: number | null,"result_visibility"?: Database["public"]['Enums']["result_visibility"],"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"status"?: Database["public"]['Enums']["exam_status"],"subject_id"?: string | null,"time_limit_minutes"?: number | null,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"instructions"?: string | null,"owner_id"?: string | null,"published_at"?: string | null,"questions_per_attempt"?: number | null,"result_visibility"?: Database["public"]['Enums']["result_visibility"],"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"status"?: Database["public"]['Enums']["exam_status"],"subject_id"?: string | null,"time_limit_minutes"?: number | null,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exams_subject_fk"
      columns: ["workspace_id","subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "exams_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"question_options": {
                  Row: {
                    "body": string,"id": string,"is_correct": boolean,"position": number,"question_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"id"?: string,"is_correct"?: boolean,"position": number,"question_id": string,"workspace_id": string
                  }
                  Update: {
                    "body"?: string,"id"?: string,"is_correct"?: boolean,"position"?: number,"question_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_options_workspace_id_question_id_fkey"
      columns: ["workspace_id","question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "author_id": string | null,"created_at": string,"default_points": number,"explanation": string | null,"id": string,"source": Database["public"]['Enums']["question_source"],"status": Database["public"]['Enums']["question_status"],"stem": string,"tags": (string)[],"type": Database["public"]['Enums']["question_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"default_points"?: number,"explanation"?: string | null,"id"?: string,"source"?: Database["public"]['Enums']["question_source"],"status"?: Database["public"]['Enums']["question_status"],"stem": string,"tags"?: (string)[],"type": Database["public"]['Enums']["question_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"default_points"?: number,"explanation"?: string | null,"id"?: string,"source"?: Database["public"]['Enums']["question_source"],"status"?: Database["public"]['Enums']["question_status"],"stem"?: string,"tags"?: (string)[],"type"?: Database["public"]['Enums']["question_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"student_answers": {
                  Row: {
                    "attempt_id": string,"attempt_question_id": string,"graded_at": string | null,"graded_by": string | null,"id": string,"is_correct": boolean | null,"needs_review": boolean,"points_awarded": number | null,"saved_at": string,"selected_option_ids": (string)[],"text_answer": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"attempt_question_id": string,"graded_at"?: string | null,"graded_by"?: string | null,"id"?: string,"is_correct"?: boolean | null,"needs_review"?: boolean,"points_awarded"?: number | null,"saved_at"?: string,"selected_option_ids"?: (string)[],"text_answer"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "attempt_id"?: string,"attempt_question_id"?: string,"graded_at"?: string | null,"graded_by"?: string | null,"id"?: string,"is_correct"?: boolean | null,"needs_review"?: boolean,"points_awarded"?: number | null,"saved_at"?: string,"selected_option_ids"?: (string)[],"text_answer"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_answers_attempt_question_id_fkey"
      columns: ["attempt_question_id"]
isOneToOne: true
      referencedRelation: "attempt_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_answers_workspace_id_attempt_id_fkey"
      columns: ["workspace_id","attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"students": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"registration_code": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id"?: string,"registration_code": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"registration_code"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subjects_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"plan": string,"type": Database["public"]['Enums']["workspace_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"plan"?: string,"type"?: Database["public"]['Enums']["workspace_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"plan"?: string,"type"?: Database["public"]['Enums']["workspace_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_questions_to_exam":
{ Args: { "p_exam_id": string,"p_question_ids": (string)[] }; Returns: number
                           },
"get_attempt":
{ Args: { "p_token": string }; Returns: Json
                           },
"get_exam_entry":
{ Args: { "p_code": string }; Returns: Json
                           },
"grade_answer":
{ Args: { "p_answer_id": string,"p_points": number }; Returns: Json
                           },
"grant_release":
{ Args: { "p_assignment_id": string,"p_extra_minutes": number,"p_kind": Database["public"]['Enums']["release_kind"],"p_reason": string,"p_student_id": string }; Returns: Json
                           },
"import_exam_questions":
{ Args: { "p_exam_id": string,"p_questions": Json }; Returns: number
                           },
"import_students":
{ Args: { "p_class_id": string,"p_students": Json }; Returns: Json
                           },
"move_exam_question":
{ Args: { "p_direction": number,"p_exam_question_id": string }; Returns: undefined
                           },
"publish_exam":
{ Args: { "p_exam_id": string }; Returns: undefined
                           },
"save_answer":
{ Args: { "p_attempt_question_id": string,"p_selected": (string)[],"p_text": string,"p_token": string }; Returns: Json
                           },
"save_question":
{ Args: { "p_explanation": string,"p_options": Json,"p_points": number,"p_question_id": string,"p_stem": string,"p_tags": (string)[],"p_type": Database["public"]['Enums']["question_type"],"p_workspace_id": string }; Returns: string
                           },
"start_attempt":
{ Args: { "p_access_code": string,"p_code": string,"p_name": string,"p_registration": string,"p_resume_token": string }; Returns: Json
                           },
"submit_attempt":
{ Args: { "p_token": string }; Returns: Json
                           },
"teacher_finalize_attempt":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"unpublish_exam":
{ Args: { "p_exam_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "attempt_status": "in_progress"|"interrupted"|"submitted"|"expired"|"superseded","exam_status": "draft"|"published","grading_status": "pending_review"|"graded","question_source": "manual"|"import"|"ai","question_status": "draft"|"approved","question_type": "single_choice"|"true_false"|"multiple_choice"|"short_answer"|"essay","release_kind": "resume"|"new_attempt","result_visibility": "score_only"|"score_and_key","workspace_role": "owner"|"admin"|"teacher","workspace_type": "personal"|"school"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "attempt_status": ["in_progress", "interrupted", "submitted", "expired", "superseded"],"exam_status": ["draft", "published"],"grading_status": ["pending_review", "graded"],"question_source": ["manual", "import", "ai"],"question_status": ["draft", "approved"],"question_type": ["single_choice", "true_false", "multiple_choice", "short_answer", "essay"],"release_kind": ["resume", "new_attempt"],"result_visibility": ["score_only", "score_and_key"],"workspace_role": ["owner", "admin", "teacher"],"workspace_type": ["personal", "school"]
          }
        }
} as const
