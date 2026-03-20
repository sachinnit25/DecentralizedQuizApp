#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Vec};

#[contracttype]
pub enum DataKey {
    Questions,
    Answers,
    Scores,
    Initialized,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Initialize the quiz with questions and answers.
    /// No auth required - permissionless, anyone can initialize once.
    pub fn init(env: Env, questions: Vec<String>, answers: Vec<String>) {
        assert!(
            !env.storage()
                .instance()
                .get::<_, bool>(&DataKey::Initialized)
                .unwrap_or(false),
            "already initialized"
        );
        assert_eq!(
            questions.len(),
            answers.len(),
            "questions and answers must have same length"
        );

        env.storage()
            .instance()
            .set(&DataKey::Questions, &questions);
        env.storage().instance().set(&DataKey::Answers, &answers);
        env.storage()
            .instance()
            .set(&DataKey::Scores, &Map::<Address, u32>::new(&env));
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    /// Submit an answer to a question. Requires auth from the submitter.
    /// Permissionless - anyone can answer any question.
    pub fn submit_answer(env: Env, user: Address, question_index: u32, answer: String) {
        user.require_auth();

        let questions: Vec<String> = env.storage().instance().get(&DataKey::Questions).unwrap();
        let answers: Vec<String> = env.storage().instance().get(&DataKey::Answers).unwrap();

        assert!(
            (question_index as u32) < questions.len(),
            "invalid question index"
        );

        let correct = answers.get(question_index).unwrap();
        let is_correct = answer == correct;

        let mut scores: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::Scores)
            .unwrap_or_else(|| Map::new(&env));

        let current_score = scores.get(user.clone()).unwrap_or(0);
        let new_score = if is_correct {
            current_score + 1
        } else {
            current_score
        };
        scores.set(user, new_score);

        env.storage().instance().set(&DataKey::Scores, &scores);
    }

    /// Get the score for a specific address.
    pub fn get_score(env: Env, addr: Address) -> u32 {
        let scores: Map<Address, u32> = env
            .storage()
            .instance()
            .get(&DataKey::Scores)
            .unwrap_or_else(|| Map::new(&env));
        scores.get(addr).unwrap_or(0)
    }

    /// Get a question by its index.
    pub fn get_question(env: Env, index: u32) -> String {
        let questions: Vec<String> = env.storage().instance().get(&DataKey::Questions).unwrap();
        questions.get(index).unwrap()
    }

    /// Get the total number of questions in the quiz.
    pub fn get_total_questions(env: Env) -> u32 {
        let questions: Vec<String> = env.storage().instance().get(&DataKey::Questions).unwrap();
        questions.len()
    }
}

mod test;
