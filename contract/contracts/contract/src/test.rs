#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, vec, Env, String, Vec};

// Test helper to create a quiz with questions and answers
fn setup_quiz(env: &Env) -> (ContractClient, Vec<String>, Vec<String>) {
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(env, &contract_id);

    let questions: Vec<String> = vec![
        env,
        String::from_str(env, "What is 2 + 2?"),
        String::from_str(env, "What is the capital of France?"),
        String::from_str(env, "What color is the sky?"),
    ];

    let answers: Vec<String> = vec![
        env,
        String::from_str(env, "4"),
        String::from_str(env, "Paris"),
        String::from_str(env, "Blue"),
    ];

    client.init(&questions, &answers);

    (client, questions, answers)
}

#[test]
fn test_init_quiz() {
    let env = Env::default();
    let (client, questions, _answers) = setup_quiz(&env);

    // Verify quiz was initialized correctly
    assert_eq!(client.get_total_questions(), 3);
    assert_eq!(client.get_question(&0), questions.get(0).unwrap());
    assert_eq!(client.get_question(&1), questions.get(1).unwrap());
    assert_eq!(client.get_question(&2), questions.get(2).unwrap());
}

#[test]
fn test_submit_correct_answer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_quiz(&env);
    let user = Address::generate(&env);

    // Submit correct answer for question 0 (answer: "4")
    client.submit_answer(&user, &0, &String::from_str(&env, "4"));

    // Verify score is 1 (1 correct answer)
    assert_eq!(client.get_score(&user), 1);
}

#[test]
fn test_submit_wrong_answer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_quiz(&env);
    let user = Address::generate(&env);

    // Submit wrong answer for question 0
    client.submit_answer(&user, &0, &String::from_str(&env, "5"));

    // Verify score is 0
    assert_eq!(client.get_score(&user), 0);
}

#[test]
fn test_multiple_questions() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_quiz(&env);
    let user = Address::generate(&env);

    // Answer all 3 questions correctly
    client.submit_answer(&user, &0, &String::from_str(&env, "4"));
    client.submit_answer(&user, &1, &String::from_str(&env, "Paris"));
    client.submit_answer(&user, &2, &String::from_str(&env, "Blue"));

    // Verify score is 3 (all correct)
    assert_eq!(client.get_score(&user), 3);
}

#[test]
fn test_partial_correct() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_quiz(&env);
    let user = Address::generate(&env);

    // Answer 2 correctly, 1 wrong
    client.submit_answer(&user, &0, &String::from_str(&env, "4")); // correct
    client.submit_answer(&user, &1, &String::from_str(&env, "London")); // wrong
    client.submit_answer(&user, &2, &String::from_str(&env, "Blue")); // correct

    // Verify score is 2
    assert_eq!(client.get_score(&user), 2);
}

#[test]
fn test_multiple_users_independent_scores() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_quiz(&env);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // User 1 answers correctly
    client.submit_answer(&user1, &0, &String::from_str(&env, "4"));
    client.submit_answer(&user1, &1, &String::from_str(&env, "Paris"));

    // User 2 answers only 1 correctly
    client.submit_answer(&user2, &0, &String::from_str(&env, "5")); // wrong

    // Verify independent scores
    assert_eq!(client.get_score(&user1), 2);
    assert_eq!(client.get_score(&user2), 0);
}

#[test]
fn test_new_user_zero_score() {
    let env = Env::default();
    let (client, _, _) = setup_quiz(&env);

    let new_user = Address::generate(&env);

    // New user has not answered yet
    assert_eq!(client.get_score(&new_user), 0);
}

#[test]
fn test_answer_updates_score() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_quiz(&env);
    let user = Address::generate(&env);

    // Initially score is 0
    assert_eq!(client.get_score(&user), 0);

    // Submit wrong answer
    client.submit_answer(&user, &0, &String::from_str(&env, "wrong"));
    assert_eq!(client.get_score(&user), 0);

    // Submit correct answer
    client.submit_answer(&user, &0, &String::from_str(&env, "4"));
    assert_eq!(client.get_score(&user), 1);
}

#[test]
#[should_panic(expected = "invalid question index")]
fn test_invalid_question_index() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_quiz(&env);
    let user = Address::generate(&env);

    // Question index 99 does not exist
    client.submit_answer(&user, &99, &String::from_str(&env, "answer"));
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let questions: Vec<String> = vec![&env, String::from_str(&env, "Q1?")];
    let answers: Vec<String> = vec![&env, String::from_str(&env, "A1")];

    // First init works
    client.init(&questions, &answers);

    // Second init should panic
    client.init(&questions, &answers);
}
