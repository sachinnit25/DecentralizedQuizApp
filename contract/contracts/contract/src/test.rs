#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, vec, Env, String, Vec};

// Test helper to create a quiz on a given client
fn create_quiz_on_client(client: &ContractClient<'_>, env: &Env) -> u32 {
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

    let creator = Address::generate(env);
    client.create_quiz(&creator, &questions, &answers)
}

fn create_quiz2_on_client(client: &ContractClient<'_>, env: &Env) -> u32 {
    let questions: Vec<String> = vec![
        env,
        String::from_str(env, "What is 1 + 1?"),
        String::from_str(env, "What is H2O?"),
    ];

    let answers: Vec<String> = vec![
        env,
        String::from_str(env, "2"),
        String::from_str(env, "Water"),
    ];

    let creator = Address::generate(env);
    client.create_quiz(&creator, &questions, &answers)
}

#[test]
fn test_create_quiz() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let quiz_id = create_quiz_on_client(&client, &env);

    // First quiz should have ID 0
    assert_eq!(quiz_id, 0);
    assert_eq!(client.get_total_questions(&0), 3);
    assert_eq!(
        client.get_question(&0, &0),
        String::from_str(&env, "What is 2 + 2?")
    );
    assert_eq!(
        client.get_question(&0, &1),
        String::from_str(&env, "What is the capital of France?")
    );
    assert_eq!(
        client.get_question(&0, &2),
        String::from_str(&env, "What color is the sky?")
    );
}

#[test]
fn test_multiple_quizzes_same_contract() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let quiz1_id = create_quiz_on_client(&client, &env);
    let quiz2_id = create_quiz2_on_client(&client, &env);

    // Quiz IDs should be sequential
    assert_eq!(quiz1_id, 0);
    assert_eq!(quiz2_id, 1);

    // Quiz 1 has 3 questions
    assert_eq!(client.get_total_questions(&0), 3);

    // Quiz 2 has 2 questions
    assert_eq!(client.get_total_questions(&1), 2);
    assert_eq!(
        client.get_question(&1, &0),
        String::from_str(&env, "What is 1 + 1?")
    );
}

#[test]
fn test_get_all_quiz_ids() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let quiz1_id = create_quiz_on_client(&client, &env);
    let quiz2_id = create_quiz2_on_client(&client, &env);

    let ids = client.get_all_quiz_ids();
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), quiz1_id);
    assert_eq!(ids.get(1).unwrap(), quiz2_id);
}

#[test]
fn test_answer_correct() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let user = Address::generate(&env);

    // Answer question 0 correctly
    client.answer_question(&user, &quiz_id, &0, &String::from_str(&env, "4"));

    // Score should be 1
    assert_eq!(client.get_score(&user, &quiz_id), 1);
}

#[test]
fn test_answer_wrong() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let user = Address::generate(&env);

    // Answer question 0 incorrectly
    client.answer_question(&user, &quiz_id, &0, &String::from_str(&env, "5"));

    // Score should be 0
    assert_eq!(client.get_score(&user, &quiz_id), 0);
}

#[test]
fn test_answer_all_questions() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let user = Address::generate(&env);

    // Answer all 3 questions correctly
    client.answer_question(&user, &quiz_id, &0, &String::from_str(&env, "4"));
    client.answer_question(&user, &quiz_id, &1, &String::from_str(&env, "Paris"));
    client.answer_question(&user, &quiz_id, &2, &String::from_str(&env, "Blue"));

    // Score should be 3
    assert_eq!(client.get_score(&user, &quiz_id), 3);
}

#[test]
fn test_partial_correct() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let user = Address::generate(&env);

    // Answer 2 correctly, 1 wrong
    client.answer_question(&user, &quiz_id, &0, &String::from_str(&env, "4")); // correct
    client.answer_question(&user, &quiz_id, &1, &String::from_str(&env, "London")); // wrong
    client.answer_question(&user, &quiz_id, &2, &String::from_str(&env, "Blue")); // correct

    // Score should be 2
    assert_eq!(client.get_score(&user, &quiz_id), 2);
}

#[test]
fn test_multiple_users_independent() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // User 1 answers 2 correctly
    client.answer_question(&user1, &quiz_id, &0, &String::from_str(&env, "4"));
    client.answer_question(&user1, &quiz_id, &1, &String::from_str(&env, "Paris"));

    // User 2 answers 1 correctly
    client.answer_question(&user2, &quiz_id, &0, &String::from_str(&env, "5")); // wrong

    // Scores should be independent
    assert_eq!(client.get_score(&user1, &quiz_id), 2);
    assert_eq!(client.get_score(&user2, &quiz_id), 0);
}

#[test]
fn test_new_user_zero_score() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let new_user = Address::generate(&env);

    // New user has not answered yet
    assert_eq!(client.get_score(&new_user, &quiz_id), 0);
}

#[test]
fn test_invalid_question_index() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let user = Address::generate(&env);

    // Question index 99 does not exist - should fail
    let result =
        client.try_answer_question(&user, &quiz_id, &99, &String::from_str(&env, "answer"));
    assert!(result.is_err());
}

#[test]
fn test_invalid_quiz_id() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    create_quiz_on_client(&client, &env);

    // Quiz ID 999 does not exist
    assert_eq!(client.get_total_questions(&999), 0);
}

#[test]
fn test_user_across_multiple_quizzes() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let quiz1_id = create_quiz_on_client(&client, &env);
    let quiz2_id = create_quiz2_on_client(&client, &env);

    let user = Address::generate(&env);

    // Answer quiz 1 questions
    client.answer_question(&user, &quiz1_id, &0, &String::from_str(&env, "4")); // correct
    client.answer_question(&user, &quiz1_id, &1, &String::from_str(&env, "Paris")); // correct

    // Answer quiz 2 questions
    client.answer_question(&user, &quiz2_id, &0, &String::from_str(&env, "2")); // correct

    // Scores should be independent per quiz
    assert_eq!(client.get_score(&user, &quiz1_id), 2);
    assert_eq!(client.get_score(&user, &quiz2_id), 1);
}

#[test]
fn test_leaderboard() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    // User 1: 3 correct
    client.answer_question(&user1, &quiz_id, &0, &String::from_str(&env, "4"));
    client.answer_question(&user1, &quiz_id, &1, &String::from_str(&env, "Paris"));
    client.answer_question(&user1, &quiz_id, &2, &String::from_str(&env, "Blue"));

    // User 2: 2 correct
    client.answer_question(&user2, &quiz_id, &0, &String::from_str(&env, "4"));
    client.answer_question(&user2, &quiz_id, &1, &String::from_str(&env, "London")); // wrong

    // User 3: 1 correct
    client.answer_question(&user3, &quiz_id, &0, &String::from_str(&env, "5")); // wrong

    let leaderboard = client.get_leaderboard(&quiz_id);
    assert_eq!(leaderboard.len(), 3);
}

#[test]
fn test_get_quiz_questions() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    let questions = client.get_quiz_questions(&quiz_id);
    assert_eq!(questions.len(), 3);
    assert_eq!(
        questions.get(0).unwrap(),
        String::from_str(&env, "What is 2 + 2?")
    );
    assert_eq!(
        questions.get(1).unwrap(),
        String::from_str(&env, "What is the capital of France?")
    );
    assert_eq!(
        questions.get(2).unwrap(),
        String::from_str(&env, "What color is the sky?")
    );
}

#[test]
fn test_empty_leaderboard() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let quiz_id = create_quiz_on_client(&client, &env);

    // No one has answered yet
    let leaderboard = client.get_leaderboard(&quiz_id);
    assert_eq!(leaderboard.len(), 0);
}

#[test]
#[should_panic(expected = "quiz not found")]
fn test_quiz_not_found() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    // Quiz ID 999 does not exist - should panic
    let _ = client.get_question(&999, &0);
}

#[test]
#[should_panic(expected = "quiz not found")]
fn test_quiz_questions_not_found() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    // Quiz ID 999 does not exist - should panic
    let _ = client.get_quiz_questions(&999);
}
