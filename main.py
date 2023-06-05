import psycopg2
import pandas as pd


def detect_outliers(data):
    query_column = 'value';
    q1 = data[query_column].quantile(0.25)
    q3 = data[query_column].quantile(0.75)
    iqr = q3 - q1
    return not data[query_column].between(q1 - (1.5 * iqr), q3 + (1.5 * iqr), inclusive='both').all()


def load_csv_into_database(path, database):
    data = pd.read_csv(path);

    if detect_outliers(data):
        print('''[%s] File load failed due to outliers''' % (path))
        return

    for index, row in data.iterrows():
        sql = """INSERT into data(timestamp, value, category) VALUES('%s', %s, '%s');""" % (
            row['timestamp'], row['value'], row['category']);
        exec_sql(sql, database);

    print('''[%s] File loaded successfully''' % (path));


def connect_database(database, user, password, host, port):
    conn = psycopg2.connect(database=database, user=user, password=password, host=host, port=port)
    conn.autocommit = True
    return conn.cursor()


def create_table(cursor):
    sql = 'CREATE TABLE IF NOT EXISTS data (' \
          'id serial PRIMARY KEY,' \
          'timestamp TIMESTAMP NOT NULL, ' \
          'value INT not null,' \
          'category VARCHAR(255) NOT NULL' \
          ');'
    exec_sql(sql, cursor);

def exec_sql(sql, cursor):
    # Creating a database
    cursor.execute(sql)
    return cursor


def close_connection(connection):
    connection.close()


def get_data_from_table(database, table_name, only_row_count = False):
    sql = '''SELECT * from %s;''' % (table_name);
    result = exec_sql(sql, database)

    if only_row_count:
        print('Rows returned', result.rowcount)
        return

    print(result.fetchall())


# connect to the database
database = "postgres"
user = 'postgres'
password = 'root'
host = '127.0.0.1'
port = '5432'
connection = connect_database(database, user, password, host, port)

# # create table if it doesnt exist
table_name = 'data'
create_table(connection)

# check table entries before testing
print('Before testing')
only_row_count = True
get_data_from_table(connection, table_name, only_row_count)

test_one_path = './testOne.csv'
test_two_path = './testTwo.csv'

load_csv_into_database(test_one_path, connection)  # should pass
load_csv_into_database(test_two_path, connection)  # should fail

# check table entries after testing
print('After testing')
only_row_count = True
get_data_from_table(connection, table_name, only_row_count)

# get_data_from_table(database);
close_connection(connection)
