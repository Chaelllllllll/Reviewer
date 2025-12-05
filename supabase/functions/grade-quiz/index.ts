// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
// Supabase Edge Function for server-side quiz grading
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { reviewerId, answers } = await req.json()

    if (!reviewerId || !answers) {
      return new Response(
        JSON.stringify({ error: 'Missing reviewerId or answers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch quiz questions with correct answers from database
    const { data: quizzes, error } = await supabaseClient
      .from('quizzes')
      .select('*')
      .eq('reviewer_id', reviewerId)
      .order('order_index', { ascending: true })

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch quiz questions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!quizzes || quizzes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No quiz found for this reviewer' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Grade the quiz
    let totalPoints = 0
    let earnedPoints = 0
    const results: Array<{ questionIndex: number; correct: boolean; earnedPoints: number }> = []

    quizzes.forEach((quiz, index) => {
      totalPoints += quiz.points || 1
      const userAnswer = answers[index]
      let isCorrect = false
      let pointsEarned = 0

      if (quiz.type === 'multiple_choice') {
        // For multiple choice, check if answer matches correct_answer
        const correctAnswer = typeof quiz.correct_answer === 'string' && /^\d+$/.test(quiz.correct_answer)
          ? parseInt(quiz.correct_answer)
          : quiz.correct_answer

        if (userAnswer !== undefined && String(userAnswer) === String(correctAnswer)) {
          isCorrect = true
          pointsEarned = quiz.points || 1
        }
      } else {
        // For subjective answers (short/long), award points if answered (manual grading needed)
        if (userAnswer && String(userAnswer).trim()) {
          isCorrect = true
          pointsEarned = quiz.points || 1
        }
      }

      earnedPoints += pointsEarned
      results.push({
        questionIndex: index,
        correct: isCorrect,
        earnedPoints: pointsEarned
      })
    })

    const percentage = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100)

    // Return only the grading results, NOT the correct answers
    return new Response(
      JSON.stringify({
        totalPoints,
        earnedPoints,
        percentage,
        results // Only includes which questions were correct, not what the correct answers are
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
