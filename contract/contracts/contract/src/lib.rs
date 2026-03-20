#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

#[contracttype]
pub enum DataKey {
    QuizCounter,
    Quiz(u32),
    Participants(u32),
    Score(u32, Address),
}

#[contracttype]
#[derive(Clone)]
pub struct Quiz {
    pub questions: Vec<String>,
    pub answers: Vec<String>,
}

#[contracttype]
#[derive(Clone)]
pub struct LeaderboardEntry {
    pub user: Address,
    pub score: u32,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Create a new quiz. Anyone can create a quiz - fully permissionless.
    /// Returns the unique quiz ID.
    pub fn create_quiz(
        env: Env,
        _creator: Address,
        questions: Vec<String>,
        answers: Vec<String>,
    ) -> u32 {
        assert_eq!(
            questions.len(),
            answers.len(),
            "questions and answers must have same length"
        );
        assert!(questions.len() > 0, "quiz must have at least one question");

        let quiz_id = env
            .storage()
            .instance()
            .get::<_, u32>(&DataKey::QuizCounter)
            .unwrap_or(0);

        let quiz = Quiz { questions, answers };
        env.storage().instance().set(&DataKey::Quiz(quiz_id), &quiz);
        env.storage()
            .instance()
            .set(&DataKey::QuizCounter, &(quiz_id + 1));
        env.storage()
            .instance()
            .set(&DataKey::Participants(quiz_id), &Vec::<Address>::new(&env));

        quiz_id
    }

    /// Answer a question in a quiz. Requires auth from the user.
    /// Permissionless - anyone can answer any question in any quiz.
    pub fn answer_question(
        env: Env,
        user: Address,
        quiz_id: u32,
        question_index: u32,
        answer: String,
    ) {
        user.require_auth();

        let quiz: Quiz = env
            .storage()
            .instance()
            .get(&DataKey::Quiz(quiz_id))
            .expect("quiz not found");

        assert!(
            question_index < quiz.questions.len(),
            "invalid question index"
        );

        let correct = quiz.answers.get(question_index).unwrap();
        let is_correct = answer == correct;

        let current_score: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Score(quiz_id, user.clone()))
            .unwrap_or(0);

        let new_score = if is_correct {
            current_score + 1
        } else {
            current_score
        };
        env.storage()
            .instance()
            .set(&DataKey::Score(quiz_id, user.clone()), &new_score);

        // Track participant
        let mut participants: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Participants(quiz_id))
            .unwrap_or_else(|| Vec::new(&env));
        if !participants.contains(&user) {
            participants.push_back(user);
            env.storage()
                .instance()
                .set(&DataKey::Participants(quiz_id), &participants);
        }
    }

    /// Get the score for a user on a specific quiz.
    pub fn get_score(env: Env, user: Address, quiz_id: u32) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Score(quiz_id, user))
            .unwrap_or(0)
    }

    /// Get a question by index from a specific quiz.
    pub fn get_question(env: Env, quiz_id: u32, index: u32) -> String {
        let quiz: Quiz = env
            .storage()
            .instance()
            .get(&DataKey::Quiz(quiz_id))
            .expect("quiz not found");
        quiz.questions.get(index).expect("invalid question index")
    }

    /// Get the total number of questions in a quiz.
    pub fn get_total_questions(env: Env, quiz_id: u32) -> u32 {
        match env
            .storage()
            .instance()
            .get::<_, Quiz>(&DataKey::Quiz(quiz_id))
        {
            Some(quiz) => quiz.questions.len(),
            None => 0,
        }
    }

    /// Get all quiz IDs created on this contract.
    pub fn get_all_quiz_ids(env: Env) -> Vec<u32> {
        let counter: u32 = env
            .storage()
            .instance()
            .get(&DataKey::QuizCounter)
            .unwrap_or(0);
        let mut ids = Vec::new(&env);
        for i in 0..counter {
            if env
                .storage()
                .instance()
                .get::<_, Quiz>(&DataKey::Quiz(i))
                .is_some()
            {
                ids.push_back(i);
            }
        }
        ids
    }

    /// Get all questions for a quiz.
    pub fn get_quiz_questions(env: Env, quiz_id: u32) -> Vec<String> {
        let quiz: Quiz = env
            .storage()
            .instance()
            .get(&DataKey::Quiz(quiz_id))
            .expect("quiz not found");
        quiz.questions
    }

    /// Get leaderboard for a quiz (all participants and their scores).
    pub fn get_leaderboard(env: Env, quiz_id: u32) -> Vec<LeaderboardEntry> {
        let participants: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Participants(quiz_id))
            .unwrap_or_else(|| Vec::new(&env));

        let mut entries = Vec::new(&env);
        for user in participants.iter() {
            let score = Self::get_score(env.clone(), user.clone(), quiz_id);
            entries.push_back(LeaderboardEntry { user, score });
        }
        entries
    }
}

mod test;
